require("dotenv").config();
const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "weather-records.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash"
});

const weatherDescriptions = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm"
};

const weatherIcons = {
  0: "sun",
  1: "sun",
  2: "cloud-sun",
  3: "cloud",
  45: "cloud-fog",
  48: "cloud-fog",
  51: "cloud-drizzle",
  53: "cloud-drizzle",
  55: "cloud-drizzle",
  61: "cloud-rain",
  63: "cloud-rain",
  65: "cloud-rain",
  71: "cloud-snow",
  73: "cloud-snow",
  75: "cloud-snow",
  80: "cloud-rain",
  81: "cloud-rain",
  82: "cloud-rain",
  95: "cloud-lightning"
};

async function ensureDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, "[]\n", "utf8");
  }
}

async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, "utf8");
  return JSON.parse(raw || "[]");
}

async function writeDb(records) {
  await ensureDb();
  await fs.writeFile(DB_PATH, JSON.stringify(records, null, 2) + "\n", "utf8");
}

function json(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(JSON.stringify(payload));
}

function text(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
  });
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function validateDateRange(startDate, endDate) {
  if (!startDate || !endDate) return "Start date and end date are required.";
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Use valid YYYY-MM-DD dates.";
  if (end < start) return "End date must be on or after the start date.";
  const days = Math.round((end - start) / 86_400_000) + 1;
  if (days > 16) return "Please choose a date range of 16 days or less.";
  return null;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "weather-assessment-app/1.0" } });
  if (!response.ok) {
    const message = response.status === 429
      ? "The external weather service is rate-limiting requests. Please wait a minute and try again."
      : `External API request failed with status ${response.status}.`;
    throw new Error(message);
  }
  return response.json();
}

async function geocodeWithNominatim(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "weather-assessment-app/1.0 contact: demo@example.com",
      "Accept": "application/json"
    }
  });

  if (!response.ok) throw new Error(`Backup location API failed with status ${response.status}.`);
  const results = await response.json();
  if (!results.length) throw new Error(`No location found for "${query}". Try a city, ZIP/postal code, landmark, or coordinates.`);

  const best = results[0];
  const address = best.address || {};
  return {
    name: address.city || address.town || address.village || address.county || best.display_name.split(",")[0],
    admin1: address.state,
    country: address.country,
    latitude: Number(best.lat),
    longitude: Number(best.lon),
    timezone: "auto",
    source: "nominatim"
  };
}

async function geocodeLocation(query) {
  const trimmed = String(query || "").trim();
  if (!trimmed) throw new Error("Enter a location to search.");

  const coordinateMatch = trimmed.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coordinateMatch) {
    const latitude = Number(coordinateMatch[1]);
    const longitude = Number(coordinateMatch[2]);
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new Error("GPS coordinates are outside the valid latitude/longitude range.");
    }
    return {
      name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      country: "Coordinates",
      latitude,
      longitude,
      timezone: "auto",
      source: "coordinates"
    };
  }

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", trimmed);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  let data;
  try {
    data = await fetchJson(url);
  } catch (error) {
    return geocodeWithNominatim(trimmed);
  }

  if (!data.results?.length) return geocodeWithNominatim(trimmed);

  const best = data.results[0];
  return {
    name: best.name,
    admin1: best.admin1,
    country: best.country,
    latitude: best.latitude,
    longitude: best.longitude,
    timezone: best.timezone || "auto",
    source: "geocoding"
  };
}

function placeLabel(place) {
  return [place.name, place.admin1, place.country].filter(Boolean).join(", ");
}

function buildForecastUrl(place, startDate, endDate) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", place.latitude);
  url.searchParams.set("longitude", place.longitude);
  url.searchParams.set("timezone", place.timezone || "auto");
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max");
  if (startDate && endDate) {
    url.searchParams.set("start_date", startDate);
    url.searchParams.set("end_date", endDate);
  } else {
    url.searchParams.set("forecast_days", "5");
  }
  return url;
}

function buildArchiveUrl(place, startDate, endDate) {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", place.latitude);
  url.searchParams.set("longitude", place.longitude);
  url.searchParams.set("timezone", place.timezone || "auto");
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max");
  return url;
}

function weatherCodeFromMetNo(symbolCode = "") {
  if (symbolCode.includes("clearsky")) return 0;
  if (symbolCode.includes("fair")) return 1;
  if (symbolCode.includes("partlycloudy")) return 2;
  if (symbolCode.includes("cloudy")) return 3;
  if (symbolCode.includes("fog")) return 45;
  if (symbolCode.includes("drizzle")) return 51;
  if (symbolCode.includes("rain")) return 61;
  if (symbolCode.includes("snow")) return 71;
  if (symbolCode.includes("thunder")) return 95;
  return 3;
}

function makeDailyFromMetNo(timeseries) {
  const days = new Map();

  for (const item of timeseries || []) {
    const date = item.time.slice(0, 10);
    const instant = item.data?.instant?.details || {};
    const next = item.data?.next_6_hours || item.data?.next_1_hours || {};
    const temp = instant.air_temperature;
    const wind = instant.wind_speed;
    const rain = next.details?.precipitation_amount;
    const symbol = next.summary?.symbol_code;

    if (!days.has(date)) {
      days.set(date, {
        date,
        temps: [],
        wind: [],
        precipitation: 0,
        symbol
      });
    }

    const day = days.get(date);
    if (Number.isFinite(temp)) day.temps.push(temp);
    if (Number.isFinite(wind)) day.wind.push(wind);
    if (Number.isFinite(rain)) day.precipitation += rain;
    if (symbol) day.symbol = symbol;
  }

  return [...days.values()].slice(0, 5).map(day => {
    const code = weatherCodeFromMetNo(day.symbol);
    return {
      date: day.date,
      code,
      summary: weatherDescriptions[code] || "Weather data",
      icon: weatherIcons[code] || "cloud",
      high: day.temps.length ? Math.max(...day.temps) : null,
      low: day.temps.length ? Math.min(...day.temps) : null,
      precipitationProbability: null,
      precipitationSum: Number(day.precipitation.toFixed(1)),
      windMax: day.wind.length ? Math.max(...day.wind) * 3.6 : null
    };
  });
}

async function getMetNoWeather(place) {
  const url = new URL("https://api.met.no/weatherapi/locationforecast/2.0/compact");
  url.searchParams.set("lat", place.latitude);
  url.searchParams.set("lon", place.longitude);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "weather-assessment-app/1.0 contact: demo@example.com",
      "Accept": "application/json"
    }
  });

  if (!response.ok) throw new Error(`Backup weather API failed with status ${response.status}.`);
  const data = await response.json();
  const timeseries = data.properties?.timeseries || [];
  const first = timeseries[0];
  const instant = first?.data?.instant?.details || {};
  const next = first?.data?.next_1_hours || first?.data?.next_6_hours || {};
  const code = weatherCodeFromMetNo(next.summary?.symbol_code);

  return {
    location: placeLabel(place),
    place,
    current: {
      time: first?.time || new Date().toISOString(),
      temperature: instant.air_temperature,
      feelsLike: instant.air_temperature,
      humidity: instant.relative_humidity,
      precipitation: next.details?.precipitation_amount ?? 0,
      wind: Number.isFinite(instant.wind_speed) ? instant.wind_speed * 3.6 : null,
      code,
      summary: weatherDescriptions[code] || "Weather data",
      icon: weatherIcons[code] || "cloud"
    },
    daily: makeDailyFromMetNo(timeseries),
    map: {
      openStreetMap: `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=11/${place.latitude}/${place.longitude}`,
      googleMaps: `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`
    },
    provider: "met.no fallback"
  };
}

function weatherCodeFromText(text = "") {
  const value = text.toLowerCase();
  if (value.includes("thunder")) return 95;
  if (value.includes("snow") || value.includes("sleet") || value.includes("ice")) return 71;
  if (value.includes("rain") || value.includes("shower")) return 61;
  if (value.includes("drizzle")) return 51;
  if (value.includes("fog") || value.includes("mist") || value.includes("haze")) return 45;
  if (value.includes("overcast") || value.includes("cloudy")) return 3;
  if (value.includes("partly")) return 2;
  if (value.includes("sunny") || value.includes("clear")) return 0;
  return 3;
}

function weatherCodeFrom7Timer(text = "") {
  const value = text.toLowerCase();
  if (value.includes("ts")) return 95;
  if (value.includes("snow")) return 71;
  if (value.includes("rain") || value.includes("shower")) return 61;
  if (value.includes("cloudy")) return 3;
  if (value.includes("pcloudy")) return 2;
  if (value.includes("clear")) return 0;
  return 3;
}

function makeDailyFrom7Timer(dataseries) {
  const days = new Map();
  const start = new Date();

  for (const item of dataseries || []) {
    const date = new Date(start.getTime() + Number(item.timepoint || 0) * 3_600_000);
    const key = toIsoDate(date);
    const temp = item.temp2m;
    const wind = item.wind10m?.speed;

    if (!days.has(key)) {
      days.set(key, {
        date: key,
        temps: [],
        wind: [],
        weather: item.weather
      });
    }

    const day = days.get(key);
    if (Number.isFinite(temp)) day.temps.push(temp);
    if (Number.isFinite(wind)) day.wind.push(wind);
    if (item.weather) day.weather = item.weather;
  }

  return [...days.values()].slice(0, 5).map(day => {
    const code = weatherCodeFrom7Timer(day.weather);
    return {
      date: day.date,
      code,
      summary: weatherDescriptions[code] || "Weather data",
      icon: weatherIcons[code] || "cloud",
      high: day.temps.length ? Math.max(...day.temps) : null,
      low: day.temps.length ? Math.min(...day.temps) : null,
      precipitationProbability: null,
      precipitationSum: null,
      windMax: day.wind.length ? Math.max(...day.wind) * 8 : null
    };
  });
}

async function getSevenTimerWeather(place) {
  const url = new URL("https://www.7timer.info/bin/api.pl");
  url.searchParams.set("lon", place.longitude);
  url.searchParams.set("lat", place.latitude);
  url.searchParams.set("product", "civil");
  url.searchParams.set("output", "json");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "weather-assessment-app/1.0",
      "Accept": "application/json"
    }
  });

  if (!response.ok) throw new Error(`Backup weather API failed with status ${response.status}.`);
  const data = await response.json();
  const daily = makeDailyFrom7Timer(data.dataseries);
  if (daily.length < 5) throw new Error("Backup weather API did not return a 5-day forecast.");

  const first = data.dataseries?.[0] || {};
  const code = weatherCodeFrom7Timer(first.weather);

  return {
    location: placeLabel(place),
    place,
    current: {
      time: new Date().toISOString(),
      temperature: first.temp2m,
      feelsLike: first.temp2m,
      humidity: null,
      precipitation: null,
      wind: Number.isFinite(first.wind10m?.speed) ? first.wind10m.speed * 8 : null,
      code,
      summary: weatherDescriptions[code] || "Weather data",
      icon: weatherIcons[code] || "cloud"
    },
    daily,
    map: {
      openStreetMap: `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=11/${place.latitude}/${place.longitude}`,
      googleMaps: `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`
    },
    provider: "7timer fallback"
  };
}

async function getWttrWeather(place) {
  const query = `${place.latitude},${place.longitude}`;
  const url = `https://wttr.in/${encodeURIComponent(query)}?format=j1`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "weather-assessment-app/1.0",
      "Accept": "application/json"
    }
  });

  if (!response.ok) throw new Error(`Backup weather API failed with status ${response.status}.`);
  const data = await response.json();
  const current = data.current_condition?.[0] || {};
  const currentSummary = current.weatherDesc?.[0]?.value || "Weather data";
  const currentCode = weatherCodeFromText(currentSummary);

  const daily = (data.weather || []).slice(0, 5).map(day => {
    const summary = day.hourly?.[4]?.weatherDesc?.[0]?.value || day.hourly?.[0]?.weatherDesc?.[0]?.value || "Weather data";
    const code = weatherCodeFromText(summary);
    return {
      date: day.date,
      code,
      summary,
      icon: weatherIcons[code] || "cloud",
      high: Number(day.maxtempC),
      low: Number(day.mintempC),
      precipitationProbability: null,
      precipitationSum: Number(day.totalSnow_cm || 0),
      windMax: Number(day.hourly?.[4]?.windspeedKmph || day.hourly?.[0]?.windspeedKmph || 0)
    };
  });

  return {
    location: placeLabel(place),
    place,
    current: {
      time: current.localObsDateTime || new Date().toISOString(),
      temperature: Number(current.temp_C),
      feelsLike: Number(current.FeelsLikeC),
      humidity: Number(current.humidity),
      precipitation: Number(current.precipMM || 0),
      wind: Number(current.windspeedKmph),
      code: currentCode,
      summary: currentSummary,
      icon: weatherIcons[currentCode] || "cloud"
    },
    daily,
    map: {
      openStreetMap: `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=11/${place.latitude}/${place.longitude}`,
      googleMaps: `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`
    },
    provider: "wttr.in fallback"
  };
}

async function getFallbackWeather(place) {
  try {
    return await getMetNoWeather(place);
  } catch {
    try {
      return await getSevenTimerWeather(place);
    } catch {
      return getWttrWeather(place);
    }
  }
}

function transformWeather(place, data) {
  const daily = data.daily?.time?.map((date, index) => {
    const code = data.daily.weather_code?.[index] ?? 0;
    return {
      date,
      code,
      summary: weatherDescriptions[code] || "Weather data",
      icon: weatherIcons[code] || "cloud",
      high: data.daily.temperature_2m_max?.[index],
      low: data.daily.temperature_2m_min?.[index],
      precipitationProbability: data.daily.precipitation_probability_max?.[index] ?? null,
      precipitationSum: data.daily.precipitation_sum?.[index] ?? null,
      windMax: data.daily.wind_speed_10m_max?.[index]
    };
  }) || [];

  return {
    location: placeLabel(place),
    place,
    current: data.current ? {
      time: data.current.time,
      temperature: data.current.temperature_2m,
      feelsLike: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      precipitation: data.current.precipitation,
      wind: data.current.wind_speed_10m,
      code: data.current.weather_code,
      summary: weatherDescriptions[data.current.weather_code] || "Weather data",
      icon: weatherIcons[data.current.weather_code] || "cloud"
    } : null,
    daily,
    map: {
      openStreetMap: `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=11/${place.latitude}/${place.longitude}`,
      googleMaps: `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`
    }
  };
}

async function getWeatherForLocation(location, startDate, endDate) {
  const dateError = startDate || endDate ? validateDateRange(startDate, endDate) : null;
  if (dateError) throw new Error(dateError);
  const place = await geocodeLocation(location);

  const today = toIsoDate(new Date());
  const targetEnd = endDate || null;
  const useArchive = startDate && targetEnd < today;
  const url = useArchive ? buildArchiveUrl(place, startDate, endDate) : buildForecastUrl(place, startDate, endDate);
  try {
    const data = await fetchJson(url);
    return transformWeather(place, data);
  } catch (error) {
    if (startDate || error.message.includes("rate-limiting")) return getFallbackWeather(place);
    throw error;
  }
}

async function getWeatherForCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("Latitude and longitude are required.");
  const place = await geocodeLocation(`${lat},${lon}`);
  try {
    const data = await fetchJson(buildForecastUrl(place));
    return transformWeather(place, data);
  } catch (error) {
    if (error.message.includes("rate-limiting")) return getFallbackWeather(place);
    throw error;
  }
}

async function locationInfo(location) {
  const place = await geocodeLocation(location);
  const title = encodeURIComponent(place.name);
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
  try {
    const wiki = await fetchJson(url);
    return {
      location: placeLabel(place),
      extract: wiki.extract || "No encyclopedia summary is available for this location.",
      sourceUrl: wiki.content_urls?.desktop?.page || null,
      maps: {
        openStreetMap: `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=11/${place.latitude}/${place.longitude}`,
        googleMaps: `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`
      }
    };
  } catch {
    return {
      location: placeLabel(place),
      extract: "Location matched successfully, but the extra location summary API did not return details.",
      sourceUrl: null,
      maps: {
        openStreetMap: `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=11/${place.latitude}/${place.longitude}`,
        googleMaps: `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`
      }
    };
  }
}

function summarizeRange(weather) {
  const highs = weather.daily.map(day => day.high).filter(Number.isFinite);
  const lows = weather.daily.map(day => day.low).filter(Number.isFinite);
  return {
    averageHigh: highs.length ? Math.round(highs.reduce((a, b) => a + b, 0) / highs.length) : null,
    averageLow: lows.length ? Math.round(lows.reduce((a, b) => a + b, 0) / lows.length) : null,
    days: weather.daily.length
  };
}

async function createRecord(payload) {
  const location = String(payload.location || "").trim();
  const startDate = String(payload.startDate || "").trim();
  const endDate = String(payload.endDate || "").trim();
  if (!location) throw new Error("Location is required.");
  const dateError = validateDateRange(startDate, endDate);
  if (dateError) throw new Error(dateError);
  const weather = await getWeatherForLocation(location, startDate, endDate);
  const records = await readDb();
  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    requestedLocation: location,
    resolvedLocation: weather.location,
    startDate,
    endDate,
    notes: String(payload.notes || "").trim(),
    weather,
    rangeSummary: summarizeRange(weather),
    createdAt: now,
    updatedAt: now
  };
  records.unshift(record);
  await writeDb(records);
  return record;
}

async function updateRecord(id, payload) {
  const records = await readDb();
  const index = records.findIndex(record => record.id === id);
  if (index === -1) throw new Error("Record not found.");

  const existing = records[index];
  const location = String(payload.location ?? existing.requestedLocation).trim();
  const startDate = String(payload.startDate ?? existing.startDate).trim();
  const endDate = String(payload.endDate ?? existing.endDate).trim();
  if (!location) throw new Error("Location is required.");
  const dateError = validateDateRange(startDate, endDate);
  if (dateError) throw new Error(dateError);

  const needsWeatherRefresh =
    location !== existing.requestedLocation ||
    startDate !== existing.startDate ||
    endDate !== existing.endDate;

  const weather = needsWeatherRefresh ? await getWeatherForLocation(location, startDate, endDate) : existing.weather;
  const updated = {
    ...existing,
    requestedLocation: location,
    resolvedLocation: weather.location,
    startDate,
    endDate,
    notes: String(payload.notes ?? existing.notes ?? "").trim(),
    weather,
    rangeSummary: summarizeRange(weather),
    updatedAt: new Date().toISOString()
  };
  records[index] = updated;
  await writeDb(records);
  return updated;
}

function csvEscape(value) {
  const textValue = value == null ? "" : String(value);
  return /[",\n]/.test(textValue) ? `"${textValue.replaceAll('"', '""')}"` : textValue;
}

function exportRecords(records, format) {
  if (format === "csv") {
    const header = ["id", "requestedLocation", "resolvedLocation", "startDate", "endDate", "averageHigh", "averageLow", "notes", "createdAt"];
    const rows = records.map(record => [
      record.id,
      record.requestedLocation,
      record.resolvedLocation,
      record.startDate,
      record.endDate,
      record.rangeSummary?.averageHigh,
      record.rangeSummary?.averageLow,
      record.notes,
      record.createdAt
    ].map(csvEscape).join(","));
    return {
      contentType: "text/csv; charset=utf-8",
      extension: "csv",
      body: [header.join(","), ...rows].join("\n")
    };
  }

  if (format === "markdown") {
    const body = [
      "# Weather Request Export",
      "",
      ...records.map(record => [
        `## ${record.resolvedLocation}`,
        "",
        `- ID: ${record.id}`,
        `- Requested: ${record.requestedLocation}`,
        `- Date range: ${record.startDate} to ${record.endDate}`,
        `- Average high: ${record.rangeSummary?.averageHigh ?? "n/a"} C`,
        `- Average low: ${record.rangeSummary?.averageLow ?? "n/a"} C`,
        `- Notes: ${record.notes || "None"}`,
        ""
      ].join("\n"))
    ].join("\n");
    return { contentType: "text/markdown; charset=utf-8", extension: "md", body };
  }

  return {
    contentType: "application/json; charset=utf-8",
    extension: "json",
    body: JSON.stringify(records, null, 2)
  };
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
  }[ext] || "application/octet-stream";
}

async function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return text(res, 403, "Forbidden");
  try {
    const file = await fs.readFile(filePath);
    text(res, 200, file, { "Content-Type": mimeType(filePath) });
  } catch {
    text(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  }
}

async function router(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    if (pathname === "/api/health") return json(res, 200, { ok: true });

    if (pathname === "/api/weather" && req.method === "GET") {
      const location = url.searchParams.get("location");
      const lat = url.searchParams.get("lat");
      const lon = url.searchParams.get("lon");
      const weather = lat && lon ? await getWeatherForCoordinates(lat, lon) : await getWeatherForLocation(location);
      return json(res, 200, weather);
    }

    if (pathname === "/api/location-info" && req.method === "GET") {
      const info = await locationInfo(url.searchParams.get("location"));
      return json(res, 200, info);
    }

    if (pathname === "/api/records" && req.method === "GET") {
      return json(res, 200, await readDb());
    }

    if (pathname === "/api/records" && req.method === "POST") {
      return json(res, 201, await createRecord(await parseBody(req)));
    }

    const recordMatch = pathname.match(/^\/api\/records\/([a-f0-9-]+)$/i);

    if (recordMatch && req.method === "PUT") {
      return json(res, 200, await updateRecord(recordMatch[1], await parseBody(req)));
    }

    if (recordMatch && req.method === "DELETE") {
      const records = await readDb();
      const next = records.filter(record => record.id !== recordMatch[1]);

      if (next.length === records.length)
        return json(res, 404, { error: "Record not found." });

      await writeDb(next);

      return json(res, 200, { ok: true });
    }

    if (pathname === "/api/export" && req.method === "GET") {
      const format = (url.searchParams.get("format") || "json").toLowerCase();

      const exported = exportRecords(
        await readDb(),
        format
      );

      return text(
        res,
        200,
        exported.body,
        {
          "Content-Type": exported.contentType,
          "Content-Disposition":
            `attachment; filename="weather-records.${exported.extension}"`
        }
      );
    }

    /* ===== GEMINI AI ROUTE ===== */

    if (
      pathname === "/api/ai-weather" &&
      req.method === "POST"
    ) {

      const body =
        await parseBody(req);

      const prompt = `
You are an intelligent weather assistant.

Current weather data:

${JSON.stringify(body.weather, null, 2)}

User question:

${body.question}

Give a short practical answer.
`;

      const result =
        await model.generateContent(
          prompt
        );

      const answer =
        result.response.text();

      return json(
        res,
        200,
        {
          answer
        }
      );
    }

    /* ===== END GEMINI ROUTE ===== */

    return serveStatic(req, res, pathname);

  } catch (error) {

    return json(
      res,
      400,
      {
        error:
          error.message ||
          "Something went wrong."
      }
    );
  }
}

ensureDb().then(() => {
  http.createServer(router).listen(PORT, () => {
    console.log(`Weather assessment app running at http://localhost:${PORT}`);
  });
});

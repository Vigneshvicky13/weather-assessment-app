const weatherForm = document.querySelector("#weather-form");
const locationInput = document.querySelector("#location-input");
const useLocationButton = document.querySelector("#use-location");
const message = document.querySelector("#message");
const weatherCard = document.querySelector("#weather-card");
const forecastSection = document.querySelector("#forecast-section");
const forecastGrid = document.querySelector("#forecast-grid");
const recordForm = document.querySelector("#record-form");
const recordIdInput = document.querySelector("#record-id");
const recordLocation = document.querySelector("#record-location");
const startDate = document.querySelector("#start-date");
const endDate = document.querySelector("#end-date");
const notes = document.querySelector("#notes");
const cancelEdit = document.querySelector("#cancel-edit");
const recordsList = document.querySelector("#records-list");
const locationInfo = document.querySelector("#location-info");
const infoCopy = document.querySelector("#info-copy");
const infoSource = document.querySelector("#info-source");
let latestWeather = null;

const iconMap = {
  sun: "☀",
  "cloud-sun": "⛅",
  cloud: "☁",
  "cloud-fog": "≋",
  "cloud-drizzle": "☂",
  "cloud-rain": "☔",
  "cloud-snow": "❄",
  "cloud-lightning": "⚡"
};

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const fiveDays = new Date(today);
fiveDays.setDate(today.getDate() + 5);
startDate.value = tomorrow.toISOString().slice(0, 10);
endDate.value = fiveDays.toISOString().slice(0, 10);

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`.trim();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function celsius(value) {
  return Number.isFinite(value) ? `${Math.round(value)}°C` : "n/a";
}

function renderWeather(data) {
  latestWeather = data;
  weatherCard.classList.remove("hidden");
  forecastSection.classList.remove("hidden");
  document.querySelector("#resolved-location").textContent = data.location;
  document.querySelector("#current-temp").textContent = data.current ? celsius(data.current.temperature) : "Range";
  document.querySelector("#current-summary").textContent = data.current?.summary || "Historical or range forecast data";
  document.querySelector("#weather-symbol").textContent = iconMap[data.current?.icon] || "☁";
  document.querySelector("#feels-like").textContent = data.current ? celsius(data.current.feelsLike) : "n/a";
  document.querySelector("#humidity").textContent = data.current?.humidity == null ? "n/a" : `${data.current.humidity}%`;
  document.querySelector("#wind").textContent = data.current?.wind == null ? "n/a" : `${Math.round(data.current.wind)} km/h`;
  document.querySelector("#precipitation").textContent = data.current?.precipitation == null ? "n/a" : `${data.current.precipitation} mm`;
  document.querySelector("#google-map-link").href = data.map.googleMaps;
  document.querySelector("#osm-link").href = data.map.openStreetMap;

  forecastGrid.innerHTML = data.daily.slice(0, 5).map(day => `
    <article class="forecast-day">
      <div class="forecast-icon" aria-hidden="true">${iconMap[day.icon] || "☁"}</div>
      <strong>${new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</strong>
      <span>${day.summary}</span>
      <span class="forecast-temp">${celsius(day.high)} / ${celsius(day.low)}</span>
      <span>Rain: ${day.precipitationProbability ?? day.precipitationSum ?? 0}${day.precipitationProbability == null ? " mm" : "%"}</span>
      <span>Wind: ${Math.round(day.windMax || 0)} km/h</span>
    </article>
  `).join("");
}

async function showLocationInfo(location) {
  try {
    const info = await api(`/api/location-info?location=${encodeURIComponent(location)}`);
    locationInfo.classList.remove("hidden");
    infoCopy.textContent = info.extract;
    infoSource.href = info.sourceUrl || info.maps.googleMaps;
    infoSource.textContent = info.sourceUrl ? "Read more" : "Open map";
  } catch {
    locationInfo.classList.add("hidden");
  }
}

weatherForm.addEventListener("submit", async event => {
  event.preventDefault();
  const location = locationInput.value.trim();
  setMessage("Loading live weather...");
  try {
    const data = await api(`/api/weather?location=${encodeURIComponent(location)}`);
    renderWeather(data);
    showLocationInfo(location);
    setMessage("Weather loaded successfully.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

useLocationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setMessage("Geolocation is not supported in this browser.", "error");
    return;
  }
  setMessage("Requesting your current location...");
  navigator.geolocation.getCurrentPosition(async position => {
    const { latitude, longitude } = position.coords;
    try {
      const data = await api(`/api/weather?lat=${latitude}&lon=${longitude}`);
      locationInput.value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      renderWeather(data);
      setMessage("Current-location weather loaded.", "success");
    } catch (error) {
      setMessage(error.message, "error");
    }
  }, () => setMessage("Location permission was denied or unavailable.", "error"));
});

function resetRecordForm() {
  recordIdInput.value = "";
  recordForm.reset();
  startDate.value = tomorrow.toISOString().slice(0, 10);
  endDate.value = fiveDays.toISOString().slice(0, 10);
  document.querySelector("#save-record").textContent = "Save record";
}

function renderRecords(records) {
  if (!records.length) {
    recordsList.innerHTML = `<p class="record-meta">No saved records yet. Create one above to demonstrate persistence.</p>`;
    return;
  }

  recordsList.innerHTML = records.map(record => `
    <article class="record-card">
      <div>
        <h3>${record.resolvedLocation}</h3>
        <span class="record-meta">${record.startDate} to ${record.endDate} · ${record.rangeSummary.days} day(s) · avg ${record.rangeSummary.averageHigh ?? "n/a"}°C high / ${record.rangeSummary.averageLow ?? "n/a"}°C low</span>
        <span class="record-meta">${record.notes || "No notes"} · saved ${new Date(record.createdAt).toLocaleString()}</span>
      </div>
      <div class="record-actions">
        <button type="button" class="ghost-button" data-edit="${record.id}">Edit</button>
        <button type="button" class="danger-button" data-delete="${record.id}">Delete</button>
      </div>
    </article>
  `).join("");

  recordsList.querySelectorAll("[data-edit]").forEach(button => {
    button.addEventListener("click", () => {
      const record = records.find(item => item.id === button.dataset.edit);
      recordIdInput.value = record.id;
      recordLocation.value = record.requestedLocation;
      startDate.value = record.startDate;
      endDate.value = record.endDate;
      notes.value = record.notes || "";
      document.querySelector("#save-record").textContent = "Update record";
      recordLocation.focus();
    });
  });

  recordsList.querySelectorAll("[data-delete]").forEach(button => {
    button.addEventListener("click", async () => {
      setMessage("Deleting record...");
      try {
        await api(`/api/records/${button.dataset.delete}`, { method: "DELETE" });
        await loadRecords();
        setMessage("Record deleted.", "success");
      } catch (error) {
        setMessage(error.message, "error");
      }
    });
  });
}

async function loadRecords() {
  const records = await api("/api/records");
  renderRecords(records);
}

recordForm.addEventListener("submit", async event => {
  event.preventDefault();
  const payload = {
    location: recordLocation.value,
    startDate: startDate.value,
    endDate: endDate.value,
    notes: notes.value
  };
  const id = recordIdInput.value;
  setMessage(id ? "Updating record and refreshing weather..." : "Saving record and fetching weather...");
  try {
    await api(id ? `/api/records/${id}` : "/api/records", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    resetRecordForm();
    await loadRecords();
    setMessage(id ? "Record updated." : "Record saved.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

cancelEdit.addEventListener("click", resetRecordForm);

loadRecords().catch(error => setMessage(error.message, "error"));
const askAiButton =
  document.querySelector("#ask-ai");

const aiQuestion =
  document.querySelector("#ai-question");

const aiAnswer =
  document.querySelector("#ai-answer");

askAiButton?.addEventListener(
  "click",
  async () => {

    if (!latestWeather) {

      aiAnswer.textContent =
        "Please load weather first.";

      return;
    }

    try {

      aiAnswer.textContent =
        "Thinking...";

      const result =
        await api(
          "/api/ai-weather",
          {
            method: "POST",

            body: JSON.stringify({
              question:
                aiQuestion.value,

              weather:
                latestWeather
            })
          }
        );

      aiAnswer.textContent =
        result.answer;

    } catch (error) {

      aiAnswer.textContent =
        error.message;

    }
  }
);

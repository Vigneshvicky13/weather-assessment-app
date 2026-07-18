# 🌦️ Weather App

A full-stack JavaScript weather application that provides real-time weather information, 5-day forecasts, weather record management, location insights, and data export functionality.

## 🌐 Live Demo

**Application:** https://weather-assessment-app-1.onrender.com/

---

## Features

- Search weather by city, town, ZIP/postal code, landmark, or GPS coordinates
- Use browser geolocation for current-location weather
- Live current weather and 5-day forecast from Open-Meteo
- Graceful error handling for invalid locations, invalid dates, API failures, and geolocation denial
- Backend REST API built with Node.js
- File-backed NoSQL-style persistence in `data/weather-records.json`
- CRUD operations for weather requests with location and date range validation
- Export saved records as JSON, CSV, or Markdown
- Location context using the Wikipedia Summary API
- Quick links to Google Maps and OpenStreetMap
- Responsive web-first user interface

---

## Tech Stack

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript

### Backend

- Node.js
- Built-in HTTP Server
- REST API

### Database

- JSON File Storage

### APIs

- Open-Meteo Forecast API
- Open-Meteo Geocoding API
- Wikipedia Page Summary API

---

## Project Structure

```text
weather-assessment-app/
│
├── public/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── manifest.json
│   └── service-worker.js
│
├── .gitignore
├── package.json
├── package-lock.json
├── render.yaml
├── server.js
└── README.md
```

---

## Requirements

- Node.js 18 or newer

---

## Run Locally

```bash
git clone https://github.com/Vigneshvicky13/weather-assessment-app.git
```

```bash
cd weather-assessment-app
```

```bash
npm install
```

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Or use the live deployment:

https://weather-assessment-app-1.onrender.com/

---

## REST API

```text
GET    /api/weather?location=London
GET    /api/weather?lat=28.6139&lon=77.2090
GET    /api/location-info?location=London
GET    /api/records
POST   /api/records
PUT    /api/records/:id
DELETE /api/records/:id
GET    /api/export?format=json
GET    /api/export?format=csv
GET    /api/export?format=markdown
```

---

## Example Create Request

```json
{
  "location": "London",
  "startDate": "2026-06-18",
  "endDate": "2026-06-22",
  "notes": "Travel planning"
}
```

---

## Notes

- Uses free public APIs that do not require API keys.
- Internet access is required to retrieve live weather information.
- When hosted on Render's free tier, the first request after inactivity may take a few seconds while the service starts.

---

## Author

**Vignesh A**

- GitHub: https://github.com/Vigneshvicky13
- Live Demo: https://weather-assessment-app-1.onrender.com/

# Weather Assessment App

Full-stack JavaScript weather app for the AI Engineer Intern technical assessment.

## Completed Assessment

This project completes both:

- Tech Assessment #1: Frontend weather app
- Tech Assessment #2: Backend weather app with CRUD, persistence, API integration, and exports

## Features

- Search weather by city, town, ZIP/postal code, landmark, or GPS coordinates
- Use browser geolocation for current-location weather
- Live current weather and 5-day forecast from Open-Meteo
- Graceful error handling for invalid locations, invalid dates, API failures, and geolocation denial
- Backend REST API built with Node.js
- File-backed NoSQL-style persistence in `data/weather-records.json`
- CRUD operations for weather requests with location and date range validation
- Exports saved records as JSON, CSV, or Markdown
- Extra API integration for location context through Wikipedia summary API
- Map links for Google Maps and OpenStreetMap
- Responsive web-first UI
- Includes developer name and PM Accelerator information

## Tech Stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js built-in HTTP server
- Database: JSON document store saved on disk
- Weather API: Open-Meteo Forecast and Geocoding APIs
- Extra API: Wikipedia Page Summary API

No npm package install is required.

## Requirements

- Node.js 18 or newer

## How To Run

```bash
npm start
```

Open:

```text
http://localhost:3000
```

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

Example create request:

```json
{
  "location": "London",
  "startDate": "2026-06-18",
  "endDate": "2026-06-22",
  "notes": "Travel planning"
}
```

## Notes For Reviewers

The app uses free public APIs that do not need API keys. Network access is required while running searches or saving weather records.

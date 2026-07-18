# 🌦️ AI Weather App

A full-stack weather application built using **HTML5, CSS3, Vanilla JavaScript, and Node.js**. The application provides real-time weather information, 5-day forecasts, weather record management, location insights, and AI-powered weather assistance through a responsive Progressive Web App (PWA).

## 🌐 Live Demo

**Application:**  
https://weather-assessment-app-1.onrender.com/

---

## 📖 Overview

AI Weather App enables users to search weather conditions anywhere in the world, view detailed forecasts, manage weather records, export saved data, and receive AI-generated weather insights. The project demonstrates full-stack web development, RESTful API design, third-party API integration, Progressive Web App features, and responsive UI development.

---

# ✨ Features

### 🌤️ Weather

- Search weather by city or town
- Search using ZIP/Postal Code
- Search using GPS coordinates
- Browser geolocation support
- Live current weather
- 5-day weather forecast

### 🤖 AI Weather Assistant

- AI-generated weather summaries
- Weather explanations in natural language
- Travel recommendations based on forecast
- Clothing suggestions
- Outdoor activity recommendations

### 📁 Weather Records

- Create weather records
- View saved records
- Update records
- Delete records

### 📤 Export

Export saved weather records as:

- JSON
- CSV
- Markdown

### 📍 Location Information

- Wikipedia location summaries
- Google Maps integration
- OpenStreetMap integration

### 📱 Progressive Web App

- Installable application
- Service Worker
- Offline asset caching
- Web App Manifest

### 🎨 User Experience

- Responsive design
- Mobile-friendly interface
- Clean UI
- Input validation
- Graceful error handling

---

# 🛠️ Tech Stack

## Frontend

- HTML5
- CSS3
- Vanilla JavaScript (ES6+)

## Backend

- Node.js
- Built-in HTTP Server
- RESTful API

## Artificial Intelligence

- Grok API (xAI)

## Progressive Web App

- Service Worker
- Web App Manifest

## Storage

- JSON File Storage

## Deployment

- Render

## External APIs

- Open-Meteo Forecast API
- Open-Meteo Geocoding API
- Wikipedia Summary API

---

# 📂 Project Structure

```text
weather-assessment-app/
│
├── public/
│   ├── app.js
│   ├── index.html
│   ├── styles.css
│   ├── manifest.json
│   ├── service-worker.js
│   ├── icon.svg
│   ├── icon-192.png
│   └── icon-512.png
│
├── .gitignore
├── package.json
├── package-lock.json
├── render.yaml
├── server.js
└── README.md
```

---

# 🚀 Getting Started

## Prerequisites

- Node.js 18 or later

### Clone the Repository

```bash
git clone https://github.com/Vigneshvicky13/weather-assessment-app.git
```

### Navigate to the Project

```bash
cd weather-assessment-app
```

### Install Dependencies

```bash
npm install
```

### Start the Application

```bash
npm start
```

Open your browser:

```
http://localhost:3000
```

Or use the live deployment:

```
https://weather-assessment-app-1.onrender.com/
```

---

# 🔗 REST API

### Weather

```http
GET /api/weather?location=London
```

```http
GET /api/weather?lat=28.6139&lon=77.2090
```

### Location Information

```http
GET /api/location-info?location=London
```

### Weather Records

```http
GET /api/records
POST /api/records
PUT /api/records/:id
DELETE /api/records/:id
```

### Export Records

```http
GET /api/export?format=json
GET /api/export?format=csv
GET /api/export?format=markdown
```

---

# 📝 Sample Request

```json
{
  "location": "London",
  "startDate": "2026-06-18",
  "endDate": "2026-06-22",
  "notes": "Travel Planning"
}
```

---

# 🌟 Highlights

- Full-stack JavaScript application
- AI-powered weather assistant
- RESTful backend architecture
- Progressive Web App (PWA)
- Real-time weather forecasting
- Browser geolocation support
- CRUD operations
- Export functionality
- Third-party API integration
- Responsive design
- Offline support with Service Worker
- Deployed on Render

---

# 🚀 Future Improvements

- User authentication
- Favorite locations
- Search history
- Hourly weather forecast
- Air quality index
- Weather alerts
- Dark mode
- Interactive weather maps
- Voice-enabled assistant
- Multi-language support
- Database integration (MongoDB/PostgreSQL)

---

# 👨‍💻 Author

**Vignesh A**

Civil Engineering (Minor in Computer Science)  
National Institute of Technology Tiruchirappalli

**GitHub:**  
https://github.com/Vigneshvicky13

**Live Demo:**  
https://weather-assessment-app-1.onrender.com/

---

⭐ If you found this project useful, consider giving it a **star** on GitHub!

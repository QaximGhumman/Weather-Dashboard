# 🌤️ Skyline — Weather Dashboard

A feature-rich weather dashboard built with plain HTML, CSS, and JavaScript — no frameworks, no build step. Live weather data, animated sky backgrounds that shift with real conditions, and a full set of extras.

![Tech](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![Tech](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Tech](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![API](https://img.shields.io/badge/OpenWeatherMap-EB6E4B?style=for-the-badge)

## ✨ Features

- 🔍 Search any city (auto geocoded)
- 📍 "Use my location" (geolocation)
- 🌡️ Current conditions: temp, feels like, humidity, wind, pressure, visibility
- 🕐 Next-24-hours hourly strip
- 📅 5-day forecast
- 📈 Temperature trend chart (Chart.js)
- 🌬️ Air Quality Index with health label
- 🌅 Sunrise/sunset with a live day-progress bar
- 🎨 **Animated sky background** that changes with real weather (rain falling, snow drifting, clouds moving, stars at night, sun glow)
- ⭐ Favorites — pin cities and jump back to them
- 🕓 Recent search history
- 🌓 Theme toggle (auto / light / dark)
- °C / °F toggle, with smart default based on your locale
- 🔗 Share button (native share sheet, or copies a summary to clipboard)
- 📴 Offline fallback — shows last saved data if the network fails

## 📂 Files

```
weather-dashboard/
├── index.html
├── style.css
└── script.js
```

## 🔑 Setup — you need a free API key

This uses [OpenWeatherMap](https://openweathermap.org/api), which is free for personal projects.

1. Go to **[openweathermap.org/api](https://openweathermap.org/api)** and create a free account
2. Go to your account → **API keys** and copy the default key (new keys can take up to an hour to activate)
3. Open the app (`index.html`) in your browser
4. Paste the key into the **"Add your API key"** banner at the top and click **Save key**

The key is stored only in your browser's local storage — nothing is sent anywhere else.

> ⚠️ Note: Since this is a pure front-end app, the API key is visible in the browser (like any client-only project). That's fine for a personal/portfolio project with the free tier, but don't reuse a key tied to a paid plan here.

## 🎨 Customize

- Sky colors per weather type are CSS variables in `style.css` (search for `--sky-a`, `--sky-b`, `--accent` under each `body[data-weather="..."]` block)
- Add more cities to the Fahrenheit auto-detect list in `script.js` (`autoDetectUnit`)
- UV Index currently shows `—` since it requires OpenWeatherMap's paid One Call tier — swap in your own source if you have access

/* ===================== CONFIG / STATE ===================== */
const LS = {
  key: "skyline_api_key",
  unit: "skyline_unit",
  theme: "skyline_theme",
  favorites: "skyline_favorites",
  history: "skyline_history",
  cache: "skyline_cache"
};

let apiKey = localStorage.getItem(LS.key) || "";
let unit = localStorage.getItem(LS.unit) || autoDetectUnit();
let theme = localStorage.getItem(LS.theme) || "auto";
let favorites = JSON.parse(localStorage.getItem(LS.favorites) || "[]");
let history = JSON.parse(localStorage.getItem(LS.history) || "[]");
let lastData = null; // { current, forecastList, air, coords, name }
let trendChart = null;

function autoDetectUnit() {
  const locale = navigator.language || "en-US";
  const fahrenheitLocales = ["en-US", "en-BZ", "en-KY", "en-LR", "my"];
  return fahrenheitLocales.includes(locale) ? "F" : "C";
}

/* ===================== DOM REFS ===================== */
const el = (id) => document.getElementById(id);
const keyBanner = el("keyBanner");
const statusBanner = el("statusBanner");
const dashboard = el("dashboard");

/* ===================== INIT ===================== */
function init() {
  document.body.setAttribute("data-theme", resolveTheme());
  el("unitBtn").textContent = "°" + unit;

  if (apiKey) {
    keyBanner.hidden = true;
    dashboard.hidden = false;
    loadLastCityOrDefault();
  } else {
    keyBanner.hidden = false;
  }

  renderFavorites();
  renderHistory();
  startSkyCanvas();

  el("saveKeyBtn").addEventListener("click", () => {
    const val = el("apiKeyInput").value.trim();
    if (!val) return;
    apiKey = val;
    localStorage.setItem(LS.key, apiKey);
    keyBanner.hidden = true;
    dashboard.hidden = false;
    loadLastCityOrDefault();
  });

  el("searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const city = el("cityInput").value.trim();
    if (city) fetchByCityName(city);
  });

  el("locBtn").addEventListener("click", useMyLocation);
  el("unitBtn").addEventListener("click", toggleUnit);
  el("themeBtn").addEventListener("click", toggleTheme);
  el("shareBtn").addEventListener("click", shareWeather);
  el("starBtn").addEventListener("click", toggleFavorite);

  window.addEventListener("resize", resizeSkyCanvas);
}

function loadLastCityOrDefault() {
  const cached = JSON.parse(localStorage.getItem(LS.cache) || "null");
  if (cached && cached.coords) {
    fetchByCoords(cached.coords.lat, cached.coords.lon, cached.name);
  } else {
    useMyLocation();
  }
}

/* ===================== NETWORK ===================== */
async function fetchByCityName(name) {
  showStatus("Searching…");
  try {
    const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(name)}&limit=1&appid=${apiKey}`);
    const geo = await geoRes.json();
    if (!geo || !geo.length) { showStatus("City not found."); return; }
    const { lat, lon, name: resolvedName } = geo[0];
    await fetchByCoords(lat, lon, resolvedName);
  } catch (err) {
    handleOffline();
  }
}

async function fetchByCoords(lat, lon, nameHint) {
  showStatus("Loading weather…");
  try {
    const [currentRes, forecastRes, airRes] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`),
      fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`)
    ]);

    if (!currentRes.ok) throw new Error("bad request");

    const current = await currentRes.json();
    const forecast = await forecastRes.json();
    const air = airRes.ok ? await airRes.json() : null;

    const name = nameHint || current.name;
    lastData = { current, forecastList: forecast.list || [], air, coords: { lat, lon }, name };

    localStorage.setItem(LS.cache, JSON.stringify(lastData));
    addToHistory(name, lat, lon);
    renderAll(lastData);
    hideStatus();
  } catch (err) {
    handleOffline();
  }
}

function handleOffline() {
  const cached = JSON.parse(localStorage.getItem(LS.cache) || "null");
  if (cached) {
    lastData = cached;
    renderAll(cached);
    showStatus("You're offline — showing last saved data.");
  } else {
    showStatus("Couldn't load weather. Check your connection or API key.");
  }
}

function useMyLocation() {
  if (!navigator.geolocation) { showStatus("Location isn't available in this browser."); return; }
  showStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(
    (pos) => fetchByCoords(pos.coords.latitude, pos.coords.longitude, null),
    () => showStatus("Location permission denied — search a city instead.")
  );
}

/* ===================== RENDER ===================== */
function renderAll(data) {
  const { current, forecastList, air, name } = data;
  const iconCode = current.weather[0].icon;
  const isNight = iconCode.includes("n");
  const category = mapCategory(current.weather[0].main, isNight);
  document.body.setAttribute("data-weather", category);

  el("cityName").childNodes[0].nodeValue = name + " ";
  el("currentDate").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  el("currentIcon").textContent = weatherEmoji(category);
  el("currentTemp").textContent = formatTemp(current.main.temp);
  el("feelsLike").textContent = "Feels like " + formatTemp(current.main.feels_like);
  el("condition").textContent = current.weather[0].description;

  el("humidity").textContent = current.main.humidity + "%";
  el("wind").textContent = Math.round(current.wind.speed * 3.6) + " km/h";
  el("pressure").textContent = current.main.pressure + " hPa";
  el("visibility").textContent = (current.visibility / 1000).toFixed(1) + " km";
  el("uv").textContent = "—";

  renderAQI(air);
  renderDaylight(current.sys.sunrise, current.sys.sunset);
  renderHourly(forecastList);
  renderDaily(forecastList);
  renderTrend(forecastList);
  updateStarState(name);
}

function renderAQI(air) {
  const stat = document.querySelector(".aqi-stat");
  if (!air || !air.list || !air.list.length) {
    el("aqi").textContent = "—";
    stat.removeAttribute("data-level");
    return;
  }
  const aqi = air.list[0].main.aqi; // 1-5
  const labels = { 1: "Good", 2: "Fair", 3: "Moderate", 4: "Poor", 5: "Very poor" };
  const levels = { 1: "good", 2: "good", 3: "moderate", 4: "unhealthy", 5: "unhealthy" };
  el("aqi").textContent = labels[aqi] || "—";
  stat.setAttribute("data-level", levels[aqi] || "");
}

function renderDaylight(sunrise, sunset) {
  const sunriseD = new Date(sunrise * 1000);
  const sunsetD = new Date(sunset * 1000);
  const now = new Date();
  el("sunrise").textContent = "🌅 " + sunriseD.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  el("sunset").textContent = "🌇 " + sunsetD.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const total = sunsetD - sunriseD;
  const elapsed = now - sunriseD;
  let pct = total > 0 ? (elapsed / total) * 100 : 0;
  pct = Math.max(0, Math.min(100, pct));
  el("daylightFill").style.width = pct + "%";
  el("daylightMarker").style.left = pct + "%";
}

function renderHourly(list) {
  const container = el("hourlyScroll");
  container.innerHTML = "";
  list.slice(0, 8).forEach((item) => {
    const time = new Date(item.dt * 1000).toLocaleTimeString([], { hour: "2-digit" });
    const cat = mapCategory(item.weather[0].main, item.weather[0].icon.includes("n"));
    const div = document.createElement("div");
    div.className = "hour-card";
    div.innerHTML = `
      <span class="htime">${time}</span>
      <span class="hicon">${weatherEmoji(cat)}</span>
      <span class="htemp">${formatTemp(item.main.temp)}</span>
    `;
    container.appendChild(div);
  });
}

function renderDaily(list) {
  const container = el("dailyList");
  container.innerHTML = "";
  const byDay = {};
  list.forEach((item) => {
    const day = new Date(item.dt * 1000).toLocaleDateString(undefined, { weekday: "short" });
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(item);
  });
  Object.entries(byDay).slice(0, 5).forEach(([day, items]) => {
    const temps = items.map(i => i.main.temp);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const midday = items[Math.floor(items.length / 2)];
    const cat = mapCategory(midday.weather[0].main, false);
    const row = document.createElement("div");
    row.className = "day-row";
    row.innerHTML = `
      <span>${day}</span>
      <span class="dicon">${weatherEmoji(cat)}</span>
      <span>${midday.weather[0].description}</span>
      <span class="drange">${formatTemp(max)} / ${formatTemp(min)}</span>
    `;
    container.appendChild(row);
  });
}

function renderTrend(list) {
  const ctx = document.getElementById("trendChart");
  const labels = list.slice(0, 8).map(i => new Date(i.dt * 1000).toLocaleTimeString([], { hour: "2-digit" }));
  const data = list.slice(0, 8).map(i => unit === "F" ? cToF(i.main.temp) : i.main.temp);

  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data,
        borderColor: getComputedStyle(document.body).getPropertyValue("--accent"),
        backgroundColor: "transparent",
        tension: 0.4,
        pointRadius: 3
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { callback: (v) => Math.round(v) + "°" } },
        x: { grid: { display: false } }
      }
    }
  });
}

/* ===================== HELPERS ===================== */
function mapCategory(main, isNight) {
  const m = (main || "").toLowerCase();
  if (isNight && (m === "clear")) return "night";
  if (m.includes("thunder")) return "thunder";
  if (m.includes("snow")) return "snow";
  if (m.includes("rain") || m.includes("drizzle")) return "rain";
  if (m.includes("cloud")) return "clouds";
  return "clear";
}

function weatherEmoji(category) {
  return { clear: "☀️", clouds: "☁️", rain: "🌧️", snow: "❄️", thunder: "⛈️", night: "🌙" }[category] || "☀️";
}

function cToF(c) { return (c * 9) / 5 + 32; }

function formatTemp(celsius) {
  const val = unit === "F" ? cToF(celsius) : celsius;
  return Math.round(val) + "°";
}

function toggleUnit() {
  unit = unit === "C" ? "F" : "C";
  localStorage.setItem(LS.unit, unit);
  el("unitBtn").textContent = "°" + unit;
  if (lastData) renderAll(lastData);
}

function resolveTheme() {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  const hour = new Date().getHours();
  return (hour >= 19 || hour < 6) ? "dark" : "light";
}

function toggleTheme() {
  const order = ["auto", "light", "dark"];
  theme = order[(order.indexOf(theme) + 1) % order.length];
  localStorage.setItem(LS.theme, theme);
  document.body.setAttribute("data-theme", resolveTheme());
}

function showStatus(msg) {
  statusBanner.textContent = msg;
  statusBanner.hidden = false;
}
function hideStatus() { statusBanner.hidden = true; }

/* ===================== FAVORITES / HISTORY ===================== */
function addToHistory(name, lat, lon) {
  history = history.filter(h => h.name !== name);
  history.unshift({ name, lat, lon });
  history = history.slice(0, 6);
  localStorage.setItem(LS.history, JSON.stringify(history));
  renderHistory();
}

function toggleFavorite() {
  if (!lastData) return;
  const { name, coords } = lastData;
  const exists = favorites.find(f => f.name === name);
  if (exists) {
    favorites = favorites.filter(f => f.name !== name);
  } else {
    favorites.push({ name, lat: coords.lat, lon: coords.lon });
  }
  localStorage.setItem(LS.favorites, JSON.stringify(favorites));
  renderFavorites();
  updateStarState(name);
}

function updateStarState(name) {
  const isFav = favorites.some(f => f.name === name);
  el("starBtn").textContent = isFav ? "★" : "☆";
}

function renderFavorites() {
  const container = el("favList");
  container.innerHTML = "";
  el("favEmptyHint").hidden = favorites.length > 0;
  favorites.forEach(f => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = `<span>${f.name}</span> <button aria-label="Remove">✕</button>`;
    chip.querySelector("span").addEventListener("click", () => fetchByCoords(f.lat, f.lon, f.name));
    chip.querySelector("button").addEventListener("click", (e) => {
      e.stopPropagation();
      favorites = favorites.filter(x => x.name !== f.name);
      localStorage.setItem(LS.favorites, JSON.stringify(favorites));
      renderFavorites();
      if (lastData) updateStarState(lastData.name);
    });
    container.appendChild(chip);
  });
}

function renderHistory() {
  const container = el("historyList");
  container.innerHTML = "";
  el("historyEmptyHint").hidden = history.length > 0;
  history.forEach(h => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = `<span>${h.name}</span>`;
    chip.addEventListener("click", () => fetchByCoords(h.lat, h.lon, h.name));
    container.appendChild(chip);
  });
}

/* ===================== SHARE ===================== */
async function shareWeather() {
  if (!lastData) return;
  const { current, name } = lastData;
  const text = `${name}: ${formatTemp(current.main.temp)}, ${current.weather[0].description}. Feels like ${formatTemp(current.main.feels_like)}.`;
  if (navigator.share) {
    try { await navigator.share({ text }); } catch (e) { /* user cancelled */ }
  } else {
    await navigator.clipboard.writeText(text);
    showStatus("Copied weather summary to clipboard.");
    setTimeout(hideStatus, 2000);
  }
}

/* ===================== SKY CANVAS BACKGROUND ===================== */
const canvas = document.getElementById("skyCanvas");
const ctx2d = canvas.getContext("2d");
let particles = [];

function resizeSkyCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function startSkyCanvas() {
  resizeSkyCanvas();
  requestAnimationFrame(drawSky);
}

function currentCategory() {
  return document.body.getAttribute("data-weather") || "clear";
}

function drawSky() {
  const w = canvas.width, h = canvas.height;
  const styles = getComputedStyle(document.body);
  const a = styles.getPropertyValue("--sky-a").trim() || "#8ec5fc";
  const b = styles.getPropertyValue("--sky-b").trim() || "#e0c3fc";

  const grad = ctx2d.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, a);
  grad.addColorStop(1, b);
  ctx2d.fillStyle = grad;
  ctx2d.fillRect(0, 0, w, h);

  const cat = currentCategory();
  if (particles.length === 0 || particles._for !== cat) {
    particles = buildParticles(cat, w, h);
    particles._for = cat;
  }
  drawParticles(cat, w, h);

  requestAnimationFrame(drawSky);
}

function buildParticles(cat, w, h) {
  const arr = [];
  const count = cat === "rain" ? 120 : cat === "snow" ? 80 : cat === "clouds" ? 6 : cat === "night" ? 60 : 0;
  for (let i = 0; i < count; i++) {
    arr.push({
      x: Math.random() * w,
      y: Math.random() * h,
      speed: 2 + Math.random() * 4,
      size: 1 + Math.random() * 3
    });
  }
  return arr;
}

function drawParticles(cat, w, h) {
  if (cat === "rain" || cat === "thunder") {
    ctx2d.strokeStyle = "rgba(255,255,255,0.35)";
    ctx2d.lineWidth = 1.5;
    particles.forEach(p => {
      ctx2d.beginPath();
      ctx2d.moveTo(p.x, p.y);
      ctx2d.lineTo(p.x, p.y + 10);
      ctx2d.stroke();
      p.y += p.speed * 3;
      if (p.y > h) { p.y = -10; p.x = Math.random() * w; }
    });
  } else if (cat === "snow") {
    ctx2d.fillStyle = "rgba(255,255,255,0.85)";
    particles.forEach(p => {
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx2d.fill();
      p.y += p.speed * 0.4;
      p.x += Math.sin(p.y * 0.02);
      if (p.y > h) { p.y = -5; p.x = Math.random() * w; }
    });
  } else if (cat === "night") {
    ctx2d.fillStyle = "rgba(255,255,255,0.8)";
    particles.forEach(p => {
      ctx2d.globalAlpha = 0.3 + Math.abs(Math.sin(Date.now() * 0.001 + p.x));
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.globalAlpha = 1;
    });
  } else if (cat === "clouds") {
    ctx2d.fillStyle = "rgba(255,255,255,0.4)";
    particles.forEach(p => {
      ctx2d.beginPath();
      ctx2d.ellipse(p.x, p.y, 60, 24, 0, 0, Math.PI * 2);
      ctx2d.fill();
      p.x += 0.2;
      if (p.x > w + 60) p.x = -60;
    });
  } else if (cat === "clear") {
    ctx2d.fillStyle = "rgba(255,255,255,0.25)";
    ctx2d.beginPath();
    ctx2d.arc(w - 90, 90, 46, 0, Math.PI * 2);
    ctx2d.fill();
  }
}

/* ===================== BOOT ===================== */
init();

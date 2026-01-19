// ==============================
// 設定値
// ==============================

// デフォルトの地点（例：東京）
const DEFAULT_LOCATION = {
  name: "東京",
  lat: 35.6895,
  lon: 139.6917,
};

// DOM 要素
const hourlyContainer = document.getElementById("hourly-container");
const locationLabel = document.getElementById("location-label");
const scrollNowButton = document.getElementById("scroll-now-button");

// ==============================
// メインフロー
// ==============================

let currentHourlyData = null; // 現在表示中の hourly データを保持

// 初期化
window.addEventListener("DOMContentLoaded", () => {
  const savedLocation = loadLocation() || DEFAULT_LOCATION;
  setLocationLabel(savedLocation.name);
  loadWeather(savedLocation.lat, savedLocation.lon);

  scrollNowButton.addEventListener("click", (e) => {
    e.preventDefault(); // ← これが必須
    if (currentHourlyData) {
      scrollToNow(currentHourlyData);
    }
  });
});

// ==============================
// 地域検索（JSON のみ）
// ==============================

const searchBox = document.getElementById("search-box");
const searchResults = document.getElementById("search-results");

searchBox.addEventListener("input", () => {
  const keyword = searchBox.value.trim();
  if (!keyword) {
    searchResults.innerHTML = "";
    return;
  }

  // JSON のみで検索
  const filtered = cities.filter(city => city.name.includes(keyword));
  renderSearchResults(filtered);
});

function renderSearchResults(list) {
  searchResults.innerHTML = "";

  list.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item.name;

    li.addEventListener("click", () => {
      setLocationLabel(item.name);
      saveLocation(item);
      loadWeather(item.lat, item.lon);

      searchResults.innerHTML = "";
      searchBox.value = "";
    });

    searchResults.appendChild(li);
  });
}

// ==============================
// API 呼び出し（天気のみ）
// ==============================

async function loadWeather(lat, lon) {
  clearHourly();
  showLoading();

  try {
    const hourly = await getWeather(lat, lon);
    currentHourlyData = hourly;
    renderHourly(hourly);

    // ★ DOM が描画されるまで 1 フレーム待つ
    setTimeout(() => {
      scrollToNow(hourly);
    }, 0);

    scrollToNow(hourly);
  } catch (error) {
    console.error("APIエラー:", error);
    showError("天気情報の取得に失敗しました。時間をおいて再度お試しください。");
  } finally {
    hideLoading();
  }
}

async function getWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,precipitation_probability,weathercode` +
    `&timezone=auto`;

  const response = await fetch(url);
  if (!response.ok) throw new Error("APIレスポンスエラー");

  const data = await response.json();
  return data.hourly;
}

// ==============================
// UI 描画
// ==============================

function renderHourly(hourly) {
  clearHourly();

  let currentDate = "";

  const times = hourly.time;
  const temps = hourly.temperature_2m;
  const rains = hourly.precipitation_probability;
  const codes = hourly.weathercode;

  for (let i = 0; i < times.length; i++) {
    const dateObj = new Date(times[i]);
    const dateStr = dateObj.toLocaleDateString("ja-JP", {
      month: "numeric",
      day: "numeric",
      weekday: "short"
    });

    // ★ 日付帯
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      const dateHeader = document.createElement("div");
      dateHeader.className = "date-header";
      dateHeader.textContent = dateStr;
      hourlyContainer.appendChild(dateHeader);
    }

    // ★ 時間ブロック
    const block = document.createElement("div");
    block.className = "hour-block";
    block.id = `hour-${i}`;

    const hourLabel = dateObj.getHours().toString().padStart(2, "0") + ":00";

    // ★ 天気アイコン（昼夜対応）
    const icon = weatherCodeToEmoji(codes[i], dateObj);

    block.style.backgroundColor = weatherCodeToColor(codes[i]);

    block.innerHTML = `
      <div class="hour-time">${hourLabel}</div>
      <div class="hour-icon">${icon}</div>
      <div class="hour-temp">${temps[i]}°C</div>
      <div class="hour-rain">${rains[i]}%</div>
    `;

    hourlyContainer.appendChild(block);
  }
}

function clearHourly() {
  hourlyContainer.innerHTML = "";
}

// ==============================
// 天気アイコン（昼夜対応）
// ==============================

function weatherCodeToEmoji(code, dateObj) {
  const hour = dateObj.getHours();
  const isNight = (hour >= 18 || hour < 6);

  const SUN = "☀️";
  const CLOUD_SUN = "⛅️";
  const MOON = "🌙";
  const CLOUD = "☁️";
  const RAIN = "🌧️";
  const SNOW = "🌨️";
  const STORM = "⛈️";
  const FOG = "🌫️";

  // --- WMO weathercode 全対応 ---

  // 0: 快晴
  if (code === 0) return isNight ? MOON : SUN;

  // 1–3: 晴れ〜曇り
  if (code === 1 || code === 2) return isNight ? MOON : CLOUD_SUN;
  if (code === 3) return CLOUD;

  // 45, 48: 霧
  if (code === 45 || code === 48) return FOG;

  // 51–57: 霧雨（強度違い）
  if (code >= 51 && code <= 57) return RAIN;

  // 61–67: 雨（強度違い・着氷性含む）
  if (code >= 61 && code <= 67) return RAIN;

  // 71–77: 雪（強度違い・雪粒含む）
  if (code >= 71 && code <= 77) return SNOW;

  // 80–82: にわか雨
  if (code >= 80 && code <= 82) return RAIN;

  // 85–86: にわか雪（←札幌で出ていたのはこれ）
  if (code === 85 || code === 86) return SNOW;

  // 95–99: 雷雨（ひょう含む）
  if (code >= 95 && code <= 99) return STORM;

  // それ以外（理論上来ないが保険）
  return CLOUD;
}

// ==============================
// 現時刻にスクロール
// ==============================

function scrollToNow(hourly) {
  const now = new Date();

  const index = hourly.time.findIndex(t => {
    const tDate = new Date(t);
    return (
      tDate.getFullYear() === now.getFullYear() &&
      tDate.getMonth() === now.getMonth() &&
      tDate.getDate() === now.getDate() &&
      tDate.getHours() === now.getHours()
    );
  });

  if (index === -1) return;

  const target = document.getElementById(`hour-${index}`);
  if (!target) return;

  const headerHeight = document.querySelector(".header").offsetHeight;

  // ★ 追加：sticky の date-header の高さを取得
  const dateHeader = document.querySelector(".date-header");
  const dateHeaderHeight = dateHeader ? dateHeader.offsetHeight : 0;

  const rect = target.getBoundingClientRect();
  const absoluteTop = rect.top + window.scrollY;

  window.scrollTo({
    top: absoluteTop - headerHeight - dateHeaderHeight - 8,
    behavior: "smooth"
  });
}

// ==============================
// weathercode → 色変換
// ==============================

function weatherCodeToColor(code) {
  if (code === 0) return "#FFD700";
  if (code >= 1 && code <= 3) return "#FFE680";
  if (code === 45 || code === 48) return "#C0C0C0";
  if (code >= 51 && code <= 67) return "#4A90E2";
  if (code >= 71 && code <= 77) return "#FFFFFF";
  if (code >= 80 && code <= 82) return "#2F5FB3";
  if (code >= 95 && code <= 99) return "#800080";
  return "#DDDDDD";
}

// ==============================
// 地域ラベル・保存
// ==============================

function setLocationLabel(name) {
  if (locationLabel) locationLabel.textContent = name;
}

function saveLocation(location) {
  localStorage.setItem("weather-location", JSON.stringify(location));
}

function loadLocation() {
  const raw = localStorage.getItem("weather-location");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ==============================
// ローディング・エラー表示
// ==============================

function showLoading() {
  const el = document.getElementById("loading");
  if (el) el.style.display = "block";
}

function hideLoading() {
  const el = document.getElementById("loading");
  if (el) el.style.display = "none";
}

function showError(message) {
  const el = document.getElementById("error");
  if (el) {
    el.textContent = message;
    el.style.display = "block";
  } else {
    alert(message);
  }
}
// Open-Meteo wrapper. Free, keyless, perfect for PWAs.

const _cache = new Map(); // key -> { ts, data }
const TTL = 30 * 60 * 1000;

export async function getWeather(lat, lon) {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return hit.data;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
    `&timezone=auto&forecast_days=4`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wetter HTTP ${res.status}`);
  const data = await res.json();
  _cache.set(key, { ts: Date.now(), data });
  return data;
}

const ICON_MAP = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️',
  56: '🌧️', 57: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  66: '🌧️', 67: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '🌨️',
  80: '🌧️', 81: '🌧️', 82: '⛈️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

export function weatherIcon(code, isDay = 1) {
  if (code === 0 && !isDay) return '🌙';
  if (code === 1 && !isDay) return '🌙';
  return ICON_MAP[code] || '❓';
}

export function dayLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / (24 * 3600 * 1000));
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()];
}

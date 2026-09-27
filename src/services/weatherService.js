/**
 * weatherService — free, keyless weather forecast for outdoor/event planning.
 *
 * Source: open-meteo.com (free, no API key, no rate limit for normal use).
 * Given an event's coordinates + date, returns that day's forecast. Open-Meteo
 * forecasts ~16 days ahead, so events further out (or in the past) return null
 * and the UI simply hides the chip. Best-effort: never throws.
 */

import { fetchWithTimeout } from '../utils/fetchWithTimeout';


// WMO weather codes → [label, Feather icon].
const WMO = {
  0: ['Clear', 'sun'], 1: ['Mainly clear', 'sun'], 2: ['Partly cloudy', 'cloud'], 3: ['Overcast', 'cloud'],
  45: ['Fog', 'cloud'], 48: ['Rime fog', 'cloud'],
  51: ['Light drizzle', 'cloud-drizzle'], 53: ['Drizzle', 'cloud-drizzle'], 55: ['Heavy drizzle', 'cloud-drizzle'],
  56: ['Freezing drizzle', 'cloud-drizzle'], 57: ['Freezing drizzle', 'cloud-drizzle'],
  61: ['Light rain', 'cloud-rain'], 63: ['Rain', 'cloud-rain'], 65: ['Heavy rain', 'cloud-rain'],
  66: ['Freezing rain', 'cloud-rain'], 67: ['Freezing rain', 'cloud-rain'],
  71: ['Light snow', 'cloud-snow'], 73: ['Snow', 'cloud-snow'], 75: ['Heavy snow', 'cloud-snow'], 77: ['Snow grains', 'cloud-snow'],
  80: ['Showers', 'cloud-rain'], 81: ['Showers', 'cloud-rain'], 82: ['Heavy showers', 'cloud-rain'],
  85: ['Snow showers', 'cloud-snow'], 86: ['Snow showers', 'cloud-snow'],
  95: ['Thunderstorm', 'cloud-lightning'], 96: ['Thunderstorm', 'cloud-lightning'], 99: ['Thunderstorm', 'cloud-lightning'],
};

const ymd = (d) => d.toISOString().slice(0, 10);

export const WeatherService = {
  /**
   * @returns {Promise<null|{tempMax:number, tempMin:number, code:number, label:string, icon:string, date:string}>}
   */
  async getForecast(lat, lon, dateStr) {
    if (lat == null || lon == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))) return null;

    const today = new Date();
    const target = dateStr ? new Date(String(dateStr).slice(0, 10) + 'T00:00:00') : today;
    if (Number.isNaN(target.getTime())) return null;

    // Open-Meteo forecast window: today .. +16 days. Outside it → no chip.
    const days = Math.round((target - new Date(ymd(today) + 'T00:00:00')) / 86400000);
    if (days < 0 || days > 16) return null;

    const date = ymd(target);
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto` +
      `&start_date=${date}&end_date=${date}`;

    try {
      const res = await fetchWithTimeout(url);
      const json = await res.json();
      const d = json && json.daily;
      if (!d || !d.time || !d.time.length) return null;
      const code = d.weather_code[0];
      const [label, icon] = WMO[code] || ['—', 'cloud'];
      return {
        tempMax: Math.round(d.temperature_2m_max[0]),
        tempMin: Math.round(d.temperature_2m_min[0]),
        code, label, icon, date,
      };
    } catch {
      return null;
    }
  },
};

export default WeatherService;
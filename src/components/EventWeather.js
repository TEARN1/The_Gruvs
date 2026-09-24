/**
 * EventWeather — shows forecast for the event date + location.
 * Uses Open-Meteo (free, no API key) + Nominatim geocoding for venues without coords.
 * Only renders for future events with a known location.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

const WMO_CODES = {
  0:  { label: 'Clear',          icon: 'sun'           },
  1:  { label: 'Mostly Clear',   icon: 'sun'           },
  2:  { label: 'Partly Cloudy',  icon: 'cloud'         },
  3:  { label: 'Overcast',       icon: 'cloud'         },
  45: { label: 'Foggy',          icon: 'wind'          },
  48: { label: 'Foggy',          icon: 'wind'          },
  51: { label: 'Light Drizzle',  icon: 'cloud-rain'    },
  53: { label: 'Drizzle',        icon: 'cloud-rain'    },
  61: { label: 'Light Rain',     icon: 'cloud-rain'    },
  63: { label: 'Rain',           icon: 'cloud-rain'    },
  65: { label: 'Heavy Rain',     icon: 'cloud-rain'    },
  71: { label: 'Light Snow',     icon: 'cloud-snow'    },
  73: { label: 'Snow',           icon: 'cloud-snow'    },
  80: { label: 'Showers',        icon: 'cloud-drizzle' },
  81: { label: 'Showers',        icon: 'cloud-drizzle' },
  95: { label: 'Thunderstorm',   icon: 'zap'           },
  99: { label: 'Thunderstorm',   icon: 'zap'           },
};

const getWeatherInfo = (code) => WMO_CODES[code] || { label: 'Unknown', icon: 'help-circle' };

const geocodeCache = {};
const geocodeVenue = async (query) => {
  if (!query) return null;
  if (geocodeCache[query]) return geocodeCache[query];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'TheGruvs/1.0' } }
    );
    const data = await res.json();
    if (data?.[0]) {
      const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      geocodeCache[query] = coords;
      return coords;
    }
  } catch {}
  return null;
};

export const EventWeather = ({ event, primary, textColor, muted, surface }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!event?.event_date) { setLoading(false); return; }

    // Only show for events within the next 16 days (Open-Meteo forecast window)
    const eventDate = new Date(event.event_date);
    const now = new Date();
    const diffDays = (eventDate - now) / 86400000;
    if (diffDays < 0 || diffDays > 16) { setLoading(false); return; }

    const fetchWeather = async () => {
      try {
        let lat = event.lat;
        let lon = event.lon;

        if (!lat || !lon) {
          const addr = [event.venue_name, event.city].filter(Boolean).join(', ');
          const coords = await geocodeVenue(addr);
          if (!coords) { setLoading(false); return; }
          lat = coords.lat;
          lon = coords.lon;
        }

        const dateStr = event.event_date.slice(0, 10);
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data?.daily) {
          const d = data.daily;
          setWeather({
            code:       d.weathercode?.[0],
            tempMax:    Math.round(d.temperature_2m_max?.[0]),
            tempMin:    Math.round(d.temperature_2m_min?.[0]),
            rainChance: d.precipitation_probability_max?.[0],
            wind:       Math.round(d.windspeed_10m_max?.[0]),
          });
        }
      } catch {}
      finally { setLoading(false); }
    };

    fetchWeather();
  }, [event?.event_date, event?.lat, event?.lon, event?.venue_name, event?.city]);

  if (loading) return (
    <View style={[w.container, { backgroundColor: `${primary}08`, borderColor: `${primary}20` }]}>
      <ActivityIndicator size="small" color={primary} />
      <Text style={[w.loadingText, { color: muted }]}>Fetching forecast...</Text>
    </View>
  );

  if (!weather) return null;

  const info = getWeatherInfo(weather.code);
  const isWet = (weather.rainChance || 0) > 50;
  const accentColor = isWet ? "#06b6d4" : weather.tempMax >= 28 ? "#f59e0b" : primary;

  return (
    <View style={[w.container, { backgroundColor: `${accentColor}08`, borderColor: `${accentColor}25` }]}>
      <View style={w.row}>
        <View style={[w.iconWrap, { backgroundColor: `${accentColor}20` }]}>
          <Feather name={info.icon} size={22} color={accentColor} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[w.label, { color: muted }]}>WEATHER ON EVENT DAY</Text>
          <Text style={[w.condition, { color: textColor }]}>{info.label}</Text>
        </View>
        <View style={w.temps}>
          <Text style={[w.tempHigh, { color: accentColor }]}>{weather.tempMax}°C</Text>
          <Text style={[w.tempLow, { color: muted }]}>{weather.tempMin}°C</Text>
        </View>
      </View>
      <View style={w.stats}>
        <View style={w.stat}>
          <Feather name="droplet" size={11} color={muted} />
          <Text style={[w.statText, { color: muted }]}>{weather.rainChance ?? '—'}% rain</Text>
        </View>
        <View style={w.stat}>
          <Feather name="wind" size={11} color={muted} />
          <Text style={[w.statText, { color: muted }]}>{weather.wind} km/h wind</Text>
        </View>
        {isWet && (
          <View style={[w.advisory, { backgroundColor: '#06b6d420', borderColor: '#06b6d440' }]}>
            <Text style={{ color: "#06b6d4", fontSize: 10, fontWeight: '700' }}>☂ Bring an umbrella</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const w = StyleSheet.create({
  container: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 16, gap: 10 },
  loadingText: { fontSize: 12, marginLeft: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  condition: { fontSize: 15, fontWeight: '800' },
  temps: { alignItems: 'flex-end', gap: 2 },
  tempHigh: { fontSize: 20, fontWeight: '900' },
  tempLow: { fontSize: 13, fontWeight: '600' },
  stats: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 11 },
  advisory: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
});

/**
 * ResidentStaysSection — "Somewhere to sleep near this event".
 *
 * Surfaces open room/guesthouse listings (res_listings) from the shared Supabase
 * project on the Gruvs event screen, scoped to the event's city. A Gruvs user
 * travelling to an event should never lack a place to stay.
 *
 * Ecosystem hook: The Resident ↔ The Gruvs (one Supabase project, two clients).
 * Table: res_listings (landlord_id FK → public.profiles.id)
 *
 * Money posture: BROKER ONLY. Prices are display data (the listing's own stored
 * currency, never FX-converted — Truth Protocol). Contact = a DM to the host via
 * the existing messages rails (first contact is request-gated). No booking, no
 * payment, no escrow.
 *
 * Safety rails:
 *   • feature('accommodation') gate — OFF until res_* is live + seeded.
 *   • Session kill-switch — the first missing-table response disables the section
 *     for the rest of the session (mirrors the residentAlerts pattern in
 *     LandingPage), so it can NEVER 404 a user on every render. A fresh app load
 *     re-probes and lights up automatically once the schema is deployed.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { feature } from '../constants/launchConfig';
import { DirectMessageModal } from './DirectMessageModal';

const RESIDENT_GREEN = '#22c55e';

// Resident (res_*) tables may not exist on the DB yet. Flipped off on the first
// missing-table response so we stop 404-ing on every load; a fresh app load
// re-probes and flips it back on once the schema is deployed.
let residentStaysEnabled = true;

const isMissingTable = (error) =>
  error?.code === 'PGRST205' ||
  error?.code === '42P01' ||
  (typeof error?.message === 'string' && error.message.includes('does not exist'));

// Rough great-circle distance (km) for a "N km away" label only — NOT used for
// filtering (there is no geo index on res_listings; city text match is the
// indexed path). Returns null unless both points are present.
const kmAway = (aLat, aLon, bLat, bLon) => {
  if (![aLat, aLon, bLat, bLon].every(v => typeof v === 'number' && Number.isFinite(v))) return null;
  const R = 6371;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLon = (bLon - aLon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
};

// ─── Single stay card ─────────────────────────────────────────────────────────

const StayCard = ({ listing, host, distanceKm, surface, textColor, muted, onContact }) => {
  const amenities = [];
  if (listing.wifi) amenities.push({ icon: 'wifi', label: 'WiFi' });
  if (listing.parking) amenities.push({ icon: 'truck', label: 'Parking' });
  if (listing.bathroom) amenities.push({ icon: 'droplet', label: `${listing.bathroom} bath` });

  const safety = listing.safety_rating;
  const safetyColor = safety === 'high' ? RESIDENT_GREEN : safety === 'low' ? '#ef4444' : '#f59e0b';

  return (
    <View style={[st.card, { backgroundColor: surface, borderColor: '#22c55e30' }]}>
      {/* Source badge — provenance is always visible */}
      <View style={st.badge}>
        <Feather name="home" size={9} color={RESIDENT_GREEN} />
        <Text style={st.badgeText}>Via The Resident</Text>
      </View>

      {/* Title + price */}
      <View style={st.row}>
        <View style={{ flex: 1 }}>
          <Text style={[st.title, { color: textColor }]} numberOfLines={2}>{listing.title}</Text>
          <Text style={[st.loc, { color: muted }]} numberOfLines={1}>
            {[listing.suburb, listing.city].filter(Boolean).join(', ')}
            {typeof distanceKm === 'number' ? `  ·  ${distanceKm} km away` : ''}
          </Text>
        </View>
        {(listing.price !== null && listing.price !== undefined) && (
          <View style={st.priceBadge}>
            <Text style={[st.priceText, { color: RESIDENT_GREEN }]}>
              {listing.currency || 'ZAR'} {listing.price}
            </Text>
          </View>
        )}
      </View>

      {/* Amenity + safety pills */}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {amenities.map(a => (
          <View key={a.label} style={st.pill}>
            <Feather name={a.icon} size={10} color={muted} />
            <Text style={[st.pillText, { color: muted }]}>{a.label}</Text>
          </View>
        ))}
        {!!safety && (
          <View style={[st.pill, { backgroundColor: `${safetyColor}14` }]}>
            <Feather name="shield" size={10} color={safetyColor} />
            <Text style={[st.pillText, { color: safetyColor }]}>{safety} safety</Text>
          </View>
        )}
      </View>

      {/* Contact — broker only: opens a DM to the host, no booking/payment */}
      <TouchableOpacity
        style={[st.cta, !host && { opacity: 0.5 }]}
        activeOpacity={0.8}
        disabled={!host}
        onPress={() => host && onContact(listing, host)}
      >
        <Feather name="message-circle" size={11} color={RESIDENT_GREEN} />
        <Text style={[st.ctaText, { color: RESIDENT_GREEN }]}>
          {host ? `Message ${host.display_name || host.username || 'host'}` : 'Host unavailable'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Section wrapper ──────────────────────────────────────────────────────────

export const ResidentStaysSection = ({ event, primary, surface, textColor, muted }) => {
  const [listings, setListings] = useState([]);
  const [hosts, setHosts] = useState({});      // landlord_id → profile
  const [loading, setLoading] = useState(true);
  const [dm, setDm] = useState(null);          // { recipient, initialMessage } | null

  const city = event?.city || null;
  const suburb = event?.suburb || null;
  const evLat = event?.lat, evLon = event?.lon;

  const fetchStays = useCallback(async () => {
    if (!residentStaysEnabled) { setLoading(false); return; }
    if (!city && !suburb) { setListings([]); setLoading(false); return; }

    let q = supabase
      .from('res_listings')
      .select('id, landlord_id, title, price, currency, location, suburb, city, lat, lon, images, bathroom, wifi, parking, safety_rating, status');
    // NOTE: no `.eq('status','open')` — the Resident's listingToRow never writes a
    // status, so requiring one exact value can hide every listing. We fetch all
    // and drop only the explicitly-unavailable ones client-side (see UNAVAILABLE).
    // City is the indexed path; fall back to suburb when the event has no city.
    if (city) q = q.eq('city', city);
    else q = q.eq('suburb', suburb);
    q = q.order('created_at', { ascending: false }).limit(12);

    const { data, error } = await q;
    if (error) {
      if (isMissingTable(error)) residentStaysEnabled = false; // disable for the session
      setListings([]);
      setLoading(false);
      return;
    }

    // Drop only clearly-unavailable listings; keep null/default/'open'/'active'.
    const UNAVAILABLE = new Set(['rented', 'closed', 'hidden', 'removed', 'sold', 'archived', 'inactive', 'draft']);
    const rows = (data || []).filter((r) => !UNAVAILABLE.has(String(r.status || '').toLowerCase()));
    setListings(rows);

    // Resolve host names/avatars in one round-trip (for the card + DM recipient).
    const ids = [...new Set(rows.map(r => r.landlord_id).filter(Boolean))];
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', ids);
      const map = {};
      (profs || []).forEach(p => { map[p.id] = p; });
      setHosts(map);
    }
    setLoading(false);
  }, [city, suburb]);

  useEffect(() => {
    if (!feature('accommodation')) { setLoading(false); return undefined; }
    fetchStays();

    if (!residentStaysEnabled || (!city && !suburb)) return undefined;
    const ch = supabase.channel(`res_stays:${city || suburb}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'res_listings',
        filter: city ? `city=eq.${city}` : `suburb=eq.${suburb}`,
      }, () => fetchStays())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [fetchStays, city, suburb]);

  const onContact = useCallback((listing, host) => {
    setDm({
      recipient: host,
      initialMessage: `Hi 👋 I saw your place "${listing.title}" on The Gruvs — I'm heading to ${event?.title || 'an event'} nearby. Is it still available?`,
    });
  }, [event?.title]);

  // Feature off → render nothing at all.
  if (!feature('accommodation')) return null;

  if (loading) return (
    <View style={{ alignItems: 'center', paddingVertical: 12 }}>
      <ActivityIndicator size="small" color={RESIDENT_GREEN} />
    </View>
  );

  if (!listings.length) return null;

  return (
    <View style={st.section}>
      <View style={st.sectionHeader}>
        <Feather name="home" size={13} color={RESIDENT_GREEN} />
        <Text style={[st.sectionTitle, { color: textColor }]}>
          Stays near here <Text style={{ color: RESIDENT_GREEN }}>({listings.length})</Text>
        </Text>
      </View>
      <Text style={[st.sub, { color: muted }]}>
        Rooms & guesthouses from The Resident — message the host directly.
      </Text>

      {listings.map(listing => (
        <StayCard
          key={listing.id}
          listing={listing}
          host={hosts[listing.landlord_id]}
          distanceKm={kmAway(evLat, evLon, listing.lat, listing.lon)}
          surface={surface}
          textColor={textColor}
          muted={muted}
          onContact={onContact}
        />
      ))}

      {dm && (
        <DirectMessageModal
          visible={!!dm}
          recipient={dm.recipient}
          initialMessage={dm.initialMessage}
          onClose={() => setDm(null)}
        />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  section:       { marginTop: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  sectionTitle:  { fontSize: 13, fontWeight: '900' },
  sub:           { fontSize: 11, marginBottom: 10 },

  card:      { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  badge:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8, alignSelf: 'flex-start',
               backgroundColor: '#22c55e12', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3,
               borderWidth: 1, borderColor: '#22c55e40' },
  badgeText: { color: RESIDENT_GREEN, fontSize: 9, fontWeight: '900', marginLeft: 4 },

  row:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 14, fontWeight: '800' },
  loc:   { fontSize: 11, fontWeight: '600', marginTop: 2 },

  priceBadge: { backgroundColor: '#22c55e12', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
                borderWidth: 1, borderColor: '#22c55e30' },
  priceText:  { fontSize: 12, fontWeight: '900' },

  pill:     { flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
              backgroundColor: 'rgba(255,255,255,0.06)' },
  pillText: { fontSize: 10, fontWeight: '600' },

  cta:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
             paddingVertical: 7, paddingHorizontal: 12, borderRadius: 9,
             backgroundColor: '#22c55e12', borderWidth: 1, borderColor: '#22c55e40',
             alignSelf: 'flex-start' },
  ctaText: { fontSize: 11, fontWeight: '900' },
});

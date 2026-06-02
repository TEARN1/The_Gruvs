import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, Image, ActivityIndicator, Share, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

// On web, we use our enhanced SVG-based QRCode that's actually scannable
import QRCode from 'react-native-qrcode-svg';


// ── Single ticket card ─────────────────────────────────────────────────────────
const TicketCard = ({ rsvp, event, primary, textColor, muted, username }) => {
  const [payload, setPayload] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(true);

  // Fetch a server-signed QR token — prevents ticket forgery
  useEffect(() => {
    if (!rsvp?.id) return;
    supabase.rpc('generate_ticket_token', { p_rsvp_id: rsvp.id })
      .then(({ data, error }) => {
        if (error || !data) {
          // Fallback to plain payload only if RPC unavailable (DB not patched yet)
          setPayload(`gruvsticket://${rsvp.event_id}/${rsvp.user_id}/${rsvp.id}`);
        } else {
          setPayload(data);
        }
      })
      .catch(() => {
        setPayload(`gruvsticket://${rsvp.event_id}/${rsvp.user_id}/${rsvp.id}`);
      })
      .finally(() => setTokenLoading(false));
  }, [rsvp?.id, rsvp?.event_id, rsvp?.user_id]);
  const dateStr = event?.event_date
    ? new Date(event.event_date).toLocaleDateString('en-ZA', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : null;
  const timeStr = event?.event_date
    ? new Date(event.event_date).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
    : null;

  const shareTicket = async () => {
    try {
      const webUrl = `https://thegruvs.vercel.app/event/${rsvp.event_id}`;
      await Share.share({
        title: `My ticket to ${event?.title || 'the Gruv'}`,
        message: Platform.OS === 'android'
          ? `My ticket to ${event?.title || 'the Gruv'}!\nDate: ${dateStr || ''} ${timeStr || ''}\nRef: ${rsvp.id?.slice(0, 8).toUpperCase()}\n\n${webUrl}`
          : `My ticket to ${event?.title || 'the Gruv'}!\nRef: ${rsvp.id?.slice(0, 8).toUpperCase()}`,
        url: webUrl,
      });
    } catch {}
  };

  return (
    <View style={[tc.card, { backgroundColor: `${primary}10`, borderColor: `${primary}30` }]}>
      {/* Event image strip */}
      {event?.media?.[0]?.url || event?.media?.[0] ? (
        <Image
          source={{ uri: event.media[0]?.url || event.media[0] }}
          style={tc.eventImg}
          resizeMode="cover"
        />
      ) : (
        <View style={[tc.eventImg, { backgroundColor: `${primary}20`, alignItems: 'center', justifyContent: 'center' }]}>
          <Feather name="music" size={28} color={primary} />
        </View>
      )}

      {/* Perforated divider */}
      <View style={[tc.divider, { borderColor: `${primary}30` }]}>
        <View style={[tc.circle, tc.circleLeft, { backgroundColor: "#0d1112" }]} />
        <View style={tc.dots}>
          {Array.from({ length: 18 }).map((_, i) => (
            <View key={i} style={[tc.dot, { backgroundColor: `${primary}30` }]} />
          ))}
        </View>
        <View style={[tc.circle, tc.circleRight, { backgroundColor: "#0d1112" }]} />
      </View>

      {/* Ticket body */}
      <View style={tc.body}>
        <View style={{ flex: 1 }}>
          <Text style={[tc.eventTitle, { color: textColor }]} numberOfLines={2}>
            {event?.title || 'Event'}
          </Text>
          {dateStr ? <Text style={[tc.meta, { color: muted }]}>{dateStr}</Text> : null}
          {timeStr ? <Text style={[tc.meta, { color: muted }]}>{timeStr}</Text> : null}
          {event?.venue_name ? <Text style={[tc.meta, { color: muted }]}>{event.venue_name}</Text> : null}
          <View style={[tc.statusPill, { backgroundColor: `${primary}20`, borderColor: `${primary}50` }]}>
            <Feather name="check-circle" size={11} color={primary} />
            <Text style={[tc.statusText, { color: primary }]}>CONFIRMED</Text>
          </View>
          <Text style={[tc.refText, { color: muted }]}>Ref: {rsvp.id?.slice(0, 8).toUpperCase()}</Text>
        </View>

        <View style={[tc.qrWrap, { backgroundColor: '#fff', borderColor: `${primary}40` }]}>
          {tokenLoading || !payload ? (
            <ActivityIndicator color={primary} size="small" style={{ width: 100, height: 100 }} />
          ) : (
            <QRCode
              value={payload}
              size={100}
              color="#000"
              backgroundColor="#fff"
              username={username}
              label="YOUR TICKET"
            />
          )}
        </View>
      </View>

      <TouchableOpacity style={[tc.shareBtn, { borderTopColor: `${primary}20` }]} onPress={shareTicket}>
        <Feather name="share-2" size={14} color={primary} />
        <Text style={[tc.shareBtnText, { color: primary }]}>Share Ticket</Text>
      </TouchableOpacity>
    </View>
  );
};

const tc = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  eventImg: { width: '100%', height: 140 },
  divider: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderStyle: 'dashed', marginHorizontal: 0 },
  circle: { width: 22, height: 22, borderRadius: 11 },
  circleLeft: { marginLeft: -11 },
  circleRight: { marginLeft: 'auto', marginRight: -11 },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: 4 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  body: { flexDirection: 'row', padding: 16, gap: 12 },
  eventTitle: { fontSize: 16, fontWeight: '900', marginBottom: 6, lineHeight: 22 },
  meta: { fontSize: 12, fontWeight: '600', marginBottom: 3 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 8 },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  refText: { fontSize: 10, fontWeight: '700', marginTop: 6, letterSpacing: 0.5 },
  qrWrap: { padding: 6, borderRadius: 10, borderWidth: 1, alignSelf: 'flex-start' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderTopWidth: 1 },
  shareBtnText: { fontSize: 13, fontWeight: '800' },
});

// ── Main modal ────────────────────────────────────────────────────────────────
export const EventTicketModal = ({ visible, onClose }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const primary   = currentTheme?.primary    || "#00f2ff";
  const bg        = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  useEffect(() => {
    if (!visible || !user) return;
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('event_rsvps')
          .select('*, events(id, title, event_date, venue_name, media)')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false })
          .limit(20);
        setTickets(data || []);
      } catch { /* keep existing tickets on transient failure */ }
      finally { setLoading(false); }
    })();
  }, [visible, user]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[m.root, { backgroundColor: bg }]}>
        {/* Header */}
        <View style={[m.header, { borderBottomColor: `${primary}20` }]}>
          <TouchableOpacity onPress={onClose} style={{ padding: 8, marginLeft: -8 }}>
            <Feather name="x" size={22} color={textColor} />
          </TouchableOpacity>
          <Text style={[m.title, { color: textColor }]}>My Tickets</Text>
          <View style={{ width: 38 }} />
        </View>

        {loading ? (
          <View style={m.center}>
            <ActivityIndicator color={primary} size="large" />
          </View>
        ) : tickets.length === 0 ? (
          <View style={m.center}>
            <Feather name="ticket" size={40} color={muted} style={{ marginBottom: 14 }} />
            <Text style={[m.empty, { color: muted }]}>No tickets yet</Text>
            <Text style={[m.emptySub, { color: muted }]}>RSVP to events to get your QR tickets here</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
            {tickets.map((rsvp) => (
              <TicketCard
                key={rsvp.id}
                rsvp={rsvp}
                event={rsvp.events}
                primary={primary}
                textColor={textColor}
                muted={muted}
                username={user?.user_metadata?.username || user?.email?.split('@')[0] || 'Viber'}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const m = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 36,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  empty: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});

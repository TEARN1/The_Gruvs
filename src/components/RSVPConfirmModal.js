import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Platform } from 'react-native';
import { GlassView } from './GlassView';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { useToast } from './ToastNotification';
import { SecurityService } from '../services/securityService';

// QRCode is not supported on web — lazy-require to avoid web crash
let QRCode = null;
if (Platform.OS !== 'web') {
  try { QRCode = require('react-native-qrcode-svg').default; } catch { QRCode = null; }
}

const SCREEN_W = Dimensions.get('window').width;

const OPTIONS = [
  { status: 'going',     label: 'Going',     icon: 'check-circle', color: '#10b981' },
  { status: 'maybe',     label: 'Maybe',     icon: 'help-circle',  color: '#f59e0b' },
  { status: 'not_going', label: 'Not Going', icon: 'x-circle',     color: '#ef4444' },
];

export const RSVPConfirmModal = ({ visible, onClose, event, onRsvped }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [rsvpId, setRsvpId] = useState(null);

  const primary   = currentTheme?.primary    || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text       || '#fff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const handleClose = () => {
    setSelected(null);
    setConfirmed(false);
    setRsvpId(null);
    onClose();
  };

  const confirm = async () => {
    if (!selected || !user || !event) return;
    setSubmitting(true);
    try {
      const result = await resilient(
        [
          async () => {
            const { data, error } = await supabase.from('event_rsvps')
              .upsert({ event_id: event.id, user_id: user.id, status: selected }, { onConflict: 'event_id,user_id' })
              .select('id').single();
            if (error) throw error;
            return data;
          },
          async () => {
            const { data, error } = await supabase.from('event_rsvps')
              .insert({ event_id: event.id, user_id: user.id, status: selected })
              .select('id').single();
            if (error) throw error;
            return data;
          },
          () => supabase.rpc('upsert_rsvp', { p_event_id: event.id, p_user_id: user.id, p_status: selected }),
        ],
        { attemptsPerTier: 3, baseMs: 400, label: `RSVPConfirmModal.confirm:${event.id}`, fallbackValue: null }
      );
      if (result !== null) {
        setRsvpId(result?.id || null);
        setConfirmed(true);
        onRsvped?.(event.id, selected);
        // Best-effort: sync going count from DB
        supabase.from('event_rsvps').select('id', { count: 'exact', head: true })
          .eq('event_id', event.id).eq('status', 'going')
          .then(({ count }) => {
            if (count !== null) supabase.from('events').update({ going: count }).eq('id', event.id).then(() => {});
          }).catch(() => {});
      } else {
        toast.show('Could not save RSVP. Try again.', 'error');
      }
    } catch {
      toast.show('Could not save RSVP. Try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!event) return null;

  const eventDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-ZA', { weekday: 'long', month: 'long', day: 'numeric' })
    : null;

  const spotsLeft = event.capacity ? event.capacity - (event.going || 0) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <GlassView style={[s.sheet, { backgroundColor: `${bg}F5` }]}>
          <View style={[s.pill, { backgroundColor: `${primary}40` }]} />

          {confirmed ? (
            <View style={s.doneWrap}>
              <View style={[s.doneIcon, { backgroundColor: `${OPTIONS.find(o => o.status === selected)?.color}20` }]}>
                <Feather name={OPTIONS.find(o => o.status === selected)?.icon || 'check'} size={40} color={OPTIONS.find(o => o.status === selected)?.color} />
              </View>
              <Text style={[s.doneTitle, { color: textColor }]}>
                {selected === 'going' ? "You're going! 🎉" : selected === 'maybe' ? "Maybe see you there!" : "RSVP saved"}
              </Text>
              <Text style={[s.doneSub, { color: muted }]}>
                {selected === 'going'
                  ? `You've RSVP'd to "${event.title}". See you at the Gruv!`
                  : `Your response for "${event.title}" has been saved.`}
              </Text>
              {selected === 'going' && rsvpId && (
                <>
                  <Text style={[s.qrLabel, { color: muted }]}>YOUR TICKET — SHOW AT DOOR</Text>
                  <View style={[s.qrWrap, { borderColor: `${primary}40` }]}>
                    {QRCode ? (
                      <QRCode
                        value={`gruvsticket://${event.id}/${user?.id}/${rsvpId}`}
                        size={140}
                        color="#000"
                        backgroundColor="#fff"
                      />
                    ) : (
                      <View style={{ alignItems: 'center', padding: 16, gap: 6 }}>
                        <Feather name="check-circle" size={48} color={primary} />
                        <Text style={{ color: muted, fontSize: 11, textAlign: 'center' }}>
                          Ticket confirmed — show this screen at the door
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.refText, { color: muted }]}>Ref: {rsvpId.slice(0, 8).toUpperCase()}</Text>
                </>
              )}
              {event.ticket_url && selected === 'going' && (
                <TouchableOpacity
                  style={[s.ticketBtn, { backgroundColor: primary }]}
                  onPress={() => SecurityService.safeOpenURL(event.ticket_url)}
                >
                  <Feather name="tag" size={15} color="#000" />
                  <Text style={s.ticketText}>External Tickets</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[s.closeBtn, { borderColor: `${primary}30` }]} onPress={handleClose}>
                <Text style={[s.closeBtnText, { color: muted }]}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity style={s.backBtn} onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={20} color={muted} />
              </TouchableOpacity>
              {event.media?.[0]?.url && (
                <Image source={{ uri: event.media[0].url }} style={s.eventThumb} resizeMode="cover" />
              )}
              <Text style={[s.eventTitle, { color: textColor }]} numberOfLines={2}>{event.title}</Text>

              <View style={s.metaRow}>
                {eventDate && (
                  <View style={s.metaChip}>
                    <Feather name="calendar" size={12} color={muted} />
                    <Text style={[s.metaText, { color: muted }]}>{eventDate}</Text>
                  </View>
                )}
                {event.event_time && (
                  <View style={s.metaChip}>
                    <Feather name="clock" size={12} color={muted} />
                    <Text style={[s.metaText, { color: muted }]}>{event.event_time}</Text>
                  </View>
                )}
                {event.venue_name && (
                  <View style={s.metaChip}>
                    <Feather name="map-pin" size={12} color={primary} />
                    <Text style={[s.metaText, { color: primary }]} numberOfLines={1}>{event.venue_name}</Text>
                  </View>
                )}
              </View>

              {spotsLeft !== null && spotsLeft > 0 && (
                <View style={[s.spotsBadge, { backgroundColor: `${primary}12`, borderColor: `${primary}28` }]}>
                  <Feather name="users" size={12} color={primary} />
                  <Text style={[s.spotsText, { color: primary }]}>{spotsLeft} spots left</Text>
                </View>
              )}
              {spotsLeft === 0 && (
                <View style={[s.spotsBadge, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)' }]}>
                  <Feather name="alert-circle" size={12} color="#ef4444" />
                  <Text style={[s.spotsText, { color: '#ef4444' }]}>Event is full</Text>
                </View>
              )}

              <Text style={[s.label, { color: muted }]}>Are you going?</Text>
              <View style={s.optionRow}>
                {OPTIONS.map(opt => {
                  const isSelected = selected === opt.status;
                  return (
                    <TouchableOpacity
                      key={opt.status}
                      onPress={() => setSelected(opt.status)}
                      style={[
                        s.optionBtn,
                        { borderColor: isSelected ? opt.color : `${opt.color}30` },
                        isSelected && { backgroundColor: `${opt.color}18` },
                      ]}
                    >
                      <Feather name={opt.icon} size={22} color={isSelected ? opt.color : muted} />
                      <Text style={[s.optionLabel, { color: isSelected ? opt.color : muted }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[s.confirmBtn, { backgroundColor: selected ? primary : `${primary}30` }]}
                onPress={confirm}
                disabled={!selected || submitting || spotsLeft === 0}
              >
                {submitting
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={s.confirmText}>
                      {spotsLeft === 0 ? 'Event Full' : 'Confirm RSVP'}
                    </Text>
                }
              </TouchableOpacity>
            </>
          )}
        </GlassView>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36 },
  backBtn: { position: 'absolute', top: 20, right: 20, zIndex: 10, padding: 4 },
  pill: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 16 },
  eventThumb: { width: '100%', height: Math.min(140, SCREEN_W * 0.35), borderRadius: 16, marginBottom: 14 },
  eventTitle: { fontSize: 20, fontWeight: '900', marginBottom: 10 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12 },
  spotsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start', marginBottom: 16 },
  spotsText: { fontSize: 12, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  optionRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  optionBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, gap: 6 },
  optionLabel: { fontSize: 12, fontWeight: '800' },
  confirmBtn: { paddingVertical: 16, borderRadius: 30, alignItems: 'center' },
  confirmText: { color: '#000', fontWeight: '900', fontSize: 16 },
  doneWrap: { alignItems: 'center', paddingVertical: 20, gap: 14 },
  doneIcon: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  doneSub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  ticketBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 30 },
  ticketText: { color: '#000', fontWeight: '900', fontSize: 15 },
  closeBtn: { paddingHorizontal: SCREEN_W < 375 ? 20 : 40, paddingVertical: 10, borderRadius: 20, borderWidth: 1, marginTop: 4 },
  closeBtnText: { fontSize: 14, fontWeight: '700' },
  qrLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginTop: 4 },
  qrWrap: { padding: 10, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1 },
  refText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
});

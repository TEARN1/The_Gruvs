/**
 * HostNoticeCard — the pinned, host-controlled info panel.
 *
 * Deliberately NOT chat (EventChatRoom.js already covers two-way, ephemeral
 * back-and-forth for every event). This is the one thing chat can't do: a
 * single, persistent, host-authored notice — "Bring your badge to Hall B,"
 * "Parking is at the north entrance" — that stays pinned above the schedule
 * instead of scrolling away in a message list.
 *
 * The same text is what a checked-in attendee gets as their welcome
 * notification (see notify_checkin_welcome() trigger,
 * supabase/queries/event_info_and_session_reminders.sql) — this card is
 * just that same message rendered persistently for anyone who didn't
 * check in, or wants to re-read it.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

export const HostNoticeCard = ({ event, primary, textColor, muted, bg }) => {
  const notice = (event?.host_notice || '').trim();
  if (!notice) return null;

  return (
    <View style={[nc.card, { borderColor: `${primary}30`, backgroundColor: `${primary}0d` }]}>
      <View style={nc.head}>
        <Feather name="info" size={14} color={primary} />
        <Text style={[nc.label, { color: primary }]}>FROM THE HOST</Text>
      </View>
      <Text style={[nc.body, { color: textColor }]}>{notice}</Text>
    </View>
  );
};

const nc = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12, marginBottom: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  label: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  body: { fontSize: 13.5, lineHeight: 19, fontWeight: '500' },
});

export default HostNoticeCard;

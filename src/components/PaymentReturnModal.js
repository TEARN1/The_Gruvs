/**
 * PaymentReturnModal — what a buyer sees when PayFast sends them back to
 * thegruvs.com/payment/success?order=… or /payment/cancelled?order=….
 *
 * Before this, those addresses opened the home feed with no word about the
 * payment. It reads the buyer's own order (payfast_orders, readable only by
 * its owner) until payfast-itn has settled it, then shows the ticket with its
 * QR code. Nothing here marks anything paid: only payfast-itn does that, after
 * PayFast confirms the payment.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

const POLL_MS = 4000;
const POLL_FOR_MS = 3 * 60 * 1000;
const ORDER_RE = /^GRV-[0-9a-f-]{36}$/i;

/** The order PayFast sent the buyer back with, from the web address; null when this isn't a payment return. */
export function readPaymentReturn(location = typeof window !== 'undefined' ? window.location : null) {
  if (!location) return null;
  const match = /^\/payment\/(success|cancelled)\/?$/.exec(location.pathname || '');
  if (!match) return null;
  const order = new URLSearchParams(location.search || '').get('order') || '';
  return { kind: match[1], order: ORDER_RE.test(order) ? order : null };
}

/** What to show for an order row (and its ticket, when issued). */
export function describeOrder(order, ticket) {
  if (!order) return { state: 'missing' };
  if (order.status === 'pending') return { state: 'pending' };
  if (order.status === 'complete' && order.status_reason === 'sandbox_no_ticket') return { state: 'test' };
  if (order.status === 'complete') return ticket ? { state: 'ticket', ticket } : { state: 'pending' };
  if (order.status === 'cancelled') return { state: 'cancelled' };
  return { state: 'problem' };
}

export const PaymentReturnModal = ({ info, onClose, onOpenTickets }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.6)';

  const [view, setView] = useState({ state: info?.kind === 'cancelled' ? 'cancelled' : 'checking' });
  const [order, setOrder] = useState(null);
  const started = useRef(Date.now());

  const check = useCallback(async () => {
    const { data: row, error } = await supabase
      .from('payfast_orders')
      .select('id, status, status_reason, tier_name, amount_cents, ticket_id, event_id, events(title)')
      .eq('m_payment_id', info.order)
      .maybeSingle();
    if (error) return false;
    setOrder(row);
    let ticket = null;
    if (row?.ticket_id) {
      const { data } = await supabase.from('ticket_tokens').select('token').eq('id', row.ticket_id).maybeSingle();
      ticket = data || null;
    }
    const next = describeOrder(row, ticket);
    setView(next);
    return next.state !== 'pending';
  }, [info?.order]);

  useEffect(() => {
    if (!info || info.kind !== 'success' || !info.order || !user) return undefined;
    let stop = false;
    let timer;
    started.current = Date.now();
    setView({ state: 'checking' });
    const tick = async () => {
      if (stop) return;
      const done = await check().catch(() => false);
      if (stop || done) return;
      if (Date.now() - started.current > POLL_FOR_MS) {
        setView({ state: 'slow' });
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [info, user, check]);

  if (!info) return null;

  const event = order?.events?.title;
  const amount = order?.amount_cents ? `R${(order.amount_cents / 100).toFixed(2)}` : null;
  let icon = 'clock';
  let title = 'Checking your payment';
  let body = 'Waiting for PayFast to confirm your payment. This usually takes a few seconds.';

  if (info.kind === 'cancelled' || view.state === 'cancelled') {
    icon = 'x-circle';
    title = 'Payment cancelled';
    body = 'No money was taken. You can try again from the event.';
  } else if (!info.order) {
    icon = 'alert-circle';
    title = 'Order not found';
    body = 'This link has no order on it. If you paid, check My Tickets on your profile.';
  } else if (!user) {
    icon = 'log-in';
    title = 'Sign in to see your ticket';
    body = 'Sign in with the account you paid with, then open this link again.';
  } else if (view.state === 'ticket') {
    icon = 'check-circle';
    title = 'Ticket confirmed';
    body = `${event ? `${event}${order?.tier_name ? ` · ${order.tier_name}` : ''}. ` : ''}${amount ? `Paid ${amount}. ` : ''}Show this code at the door. It is also in My Tickets on your profile.`;
  } else if (view.state === 'test') {
    icon = 'info';
    title = 'Test payment';
    body = 'This was a PayFast test payment, so no real ticket was issued.';
  } else if (view.state === 'problem') {
    icon = 'alert-circle';
    title = 'Payment not accepted';
    body = 'PayFast did not confirm this payment, so no ticket was issued. If money left your account, contact us with your order number.';
  } else if (view.state === 'missing') {
    icon = 'alert-circle';
    title = 'Order not found';
    body = 'We could not find this order on your account. Make sure you are signed in with the account you paid with.';
  } else if (view.state === 'slow') {
    icon = 'clock';
    title = 'Not confirmed yet';
    body = 'PayFast has not confirmed this payment yet. It can take a few minutes. Your ticket will appear in My Tickets as soon as it does.';
  }

  const busy = info.kind === 'success' && info.order && user && (view.state === 'checking' || view.state === 'pending');

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.card, { backgroundColor: bg, borderColor: `${primary}30` }]} accessibilityRole="alert">
          <View style={[s.icon, { backgroundColor: `${primary}18`, borderColor: `${primary}40` }]}>
            {busy ? <ActivityIndicator color={primary} /> : <Feather name={icon} size={22} color={primary} />}
          </View>
          <Text style={[s.title, { color: textColor }]}>{title}</Text>
          <Text style={[s.sub, { color: muted }]}>{body}</Text>
          {view.state === 'ticket' && view.ticket?.token ? (
            <View style={s.qrWrap}>
              <View style={s.qrBg}>
                <QRCode value={view.ticket.token} size={168} />
              </View>
              <Text selectable style={[s.code, { color: textColor }]}>{view.ticket.token}</Text>
            </View>
          ) : null}
          {info.order ? <Text selectable style={[s.ref, { color: muted }]}>Order {info.order}</Text> : null}
          <View style={s.row}>
            {view.state === 'ticket' || view.state === 'slow' ? (
              <TouchableOpacity style={[s.btn, { backgroundColor: primary }]} onPress={onOpenTickets} activeOpacity={0.85} accessibilityRole="button">
                <Text style={s.btnText}>My Tickets</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[s.btn, s.btnGhost, { borderColor: `${primary}50` }]} onPress={onClose} activeOpacity={0.85} accessibilityRole="button">
              <Text style={[s.btnText, { color: textColor }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 400, borderRadius: 20, borderWidth: 1, padding: 24, alignItems: 'center' },
  icon: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  qrWrap: { alignItems: 'center', marginTop: 18 },
  qrBg: { backgroundColor: '#fff', padding: 12, borderRadius: 12 },
  code: { marginTop: 10, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  ref: { marginTop: 14, fontSize: 11 },
  row: { flexDirection: 'row', gap: 10, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' },
  btn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, minHeight: 44, justifyContent: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1 },
  btnText: { color: '#000', fontWeight: '800', fontSize: 14 },
});

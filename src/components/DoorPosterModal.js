/**
 * DoorPosterModal — the printable A5 sign that goes on the door (BD_PLAYBOOK §4.5).
 *
 * The concierge motion needs a physical prompt at the venue: a QR that opens THIS
 * event and carries the host's referral code, so a scan at the door becomes an
 * attributable Touch Down. Previously the playbook asked for this and nothing
 * generated it — hosts were told to paste a link into a random QR site, which
 * loses the per-event attribution the whole scoreboard depends on.
 *
 * Print path: web uses the browser's own print dialog (no expo-print dependency,
 * which keeps this inside the zero-recurring-cost constraint). On native there's
 * no printer, so we share the link instead — hosts print from a laptop anyway.
 */
import React, { useMemo, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Share } from 'react-native';
import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { doorUrl } from '../utils/doorCode';

export const DoorPosterModal = ({ visible, onClose, event, hostRefCode, primary = '#00f2ff' }) => {
  const url = useMemo(() => doorUrl(event, hostRefCode), [event, hostRefCode]);

  // Print rules go straight into the document head rather than being rendered as
  // a <style> child: react-native-web's Modal portals its children, and a raw
  // DOM element smuggled through it is not something RN guarantees will render.
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || typeof document === 'undefined') return;
    const el = document.createElement('style');
    el.setAttribute('data-gruvs', 'door-poster-print');
    el.textContent = `
      @media print {
        body * { visibility: hidden !important; }
        [data-door-sheet], [data-door-sheet] * { visibility: visible !important; }
        [data-door-sheet] {
          position: absolute !important; left: 0; top: 0;
          width: 100% !important; border: none !important; box-shadow: none !important;
        }
        @page { margin: 12mm; }
      }
    `;
    document.head.appendChild(el);
    return () => { try { el.remove(); } catch { /* already detached */ } };
  }, [visible]);

  const print = async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try { window.print(); return; } catch { /* fall through to share */ }
    }
    try {
      await Share.share({
        message: `Door sign for ${event?.title || 'the event'} — open on a laptop and print:\n${url}`,
        url,
      });
    } catch { /* user dismissed */ }
  };

  if (!event) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={dp.root}>
        <View style={dp.bar}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close door sign">
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={dp.barTitle}>Door sign</Text>
          <TouchableOpacity onPress={print} accessibilityRole="button" accessibilityLabel="Print door sign" style={[dp.printBtn, { backgroundColor: primary }]}>
            <Feather name={Platform.OS === 'web' ? 'printer' : 'share-2'} size={14} color="#000" />
            <Text style={dp.printText}>{Platform.OS === 'web' ? 'Print' : 'Send to print'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={dp.scroll}>
          {/* The sheet itself — white, high contrast, readable across a dark room. */}
          <View style={dp.sheet} {...(Platform.OS === 'web' ? { dataSet: { doorSheet: 'true' } } : {})}>
            <Text style={dp.kicker}>ON THE GRUVS</Text>
            <Text style={dp.title} numberOfLines={3}>{event.title}</Text>
            {event.venue_name ? <Text style={dp.venue}>{event.venue_name}</Text> : null}

            <View style={dp.qrBox}>
              <QRCode value={url} size={260} color="#000" backgroundColor="#fff" />
            </View>

            <Text style={dp.cta}>Scan to Touch Down</Text>
            <Text style={dp.sub}>See who's actually inside — and you're on the guest list next time.</Text>
            <Text style={dp.urlText}>thegruvs.com</Text>
          </View>

          <Text style={dp.hint}>
            Print A5 or bigger and put it at eye level at the door. The code is specific to
            this event{hostRefCode ? ' and to you' : ''}, so every scan is counted against this night.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const dp = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0f' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14 },
  barTitle: { color: '#fff', fontSize: 16, fontWeight: '900', marginRight: 'auto' },
  printBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  printText: { color: '#000', fontWeight: '900', fontSize: 13 },
  scroll: { padding: 16, paddingBottom: 48 },
  sheet: { backgroundColor: '#fff', borderRadius: 8, padding: 28, alignItems: 'center' },
  kicker: { color: '#666', fontSize: 13, fontWeight: '900', letterSpacing: 3 },
  title: { color: '#000', fontSize: 32, fontWeight: '900', textAlign: 'center', marginTop: 10, lineHeight: 36 },
  venue: { color: '#444', fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  qrBox: { padding: 14, backgroundColor: '#fff', marginTop: 22 },
  cta: { color: '#000', fontSize: 26, fontWeight: '900', marginTop: 16, textAlign: 'center' },
  sub: { color: '#333', fontSize: 14, textAlign: 'center', marginTop: 8, maxWidth: 320, lineHeight: 20 },
  urlText: { color: '#888', fontSize: 12, fontWeight: '800', marginTop: 18, letterSpacing: 1 },
  hint: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center', marginTop: 18, lineHeight: 18 },
});

export default DoorPosterModal;

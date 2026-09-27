/**
 * Paywall + ProGate — the upsell surface for Gruvs Pro.
 *
 * <ProGate feature="who_viewed_you"> wraps any premium feature: if the user is
 * entitled (or monetization is off) it renders children untouched; otherwise it
 * renders a tappable "locked" affordance that opens the Paywall. The Paywall
 * lists what Pro unlocks and fires onUpgrade — which stays a soft "coming soon"
 * until a real IAP rail (RevenueCat) is wired. No payment SDK here.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './ToastNotification';
import { useEntitlement } from '../context/EntitlementContext';
import { PRO_FEATURES } from '../constants/entitlements';
import { haptics } from '../utils/haptics';

export const Paywall = ({ visible, onClose, highlight, onUpgrade }) => {
  const { currentTheme } = useTheme();
  const toast = useToast();
  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.55)';

  const handleUpgrade = () => {
    try { haptics.select?.(); } catch {}
    if (onUpgrade) onUpgrade();
    else toast?.show('Gruvs Pro is coming soon — you’ll be first to know.', 'info');
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pw.overlay}>
        <View style={[pw.sheet, { backgroundColor: bg, borderColor: `${primary}30` }]}>
          <View style={pw.header}>
            <View style={[pw.badge, { backgroundColor: `${primary}1f` }]}>
              <Feather name="zap" size={13} color={primary} />
              <Text style={[pw.badgeText, { color: primary }]}>GRUVS PRO</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color={muted} />
            </TouchableOpacity>
          </View>

          <Text style={[pw.title, { color: textColor }]}>Go deeper. Stay ahead.</Text>
          <Text style={[pw.sub, { color: muted }]}>
            Posting, discovering and Touching Down stay free, always. Pro unlocks the power tools.
          </Text>

          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {Object.entries(PRO_FEATURES).map(([key, f]) => {
              const isHighlight = key === highlight;
              return (
                <View key={key} style={[pw.row, isHighlight && { backgroundColor: `${primary}12`, borderRadius: 12 }]}>
                  <Feather name={isHighlight ? 'star' : 'check'} size={16} color={primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[pw.feat, { color: textColor }]}>{f.label}</Text>
                    {!!f.blurb && <Text style={[pw.blurb, { color: muted }]}>{f.blurb}</Text>}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity onPress={handleUpgrade} activeOpacity={0.85} style={[pw.cta, { backgroundColor: primary }]}>
            <Feather name="zap" size={16} color="#000" />
            <Text style={pw.ctaText}>Get Gruvs Pro</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

/**
 * Gate any premium feature. Usage:
 *   <ProGate feature="who_viewed_you"><ViewedYouList /></ProGate>
 * When unlocked (or monetization off) it renders children verbatim.
 */
export const ProGate = ({ feature, children, fallback }) => {
  const { can } = useEntitlement();
  const [paywall, setPaywall] = useState(false);

  if (can(feature)) return children;

  return (
    <>
      {fallback
        ? React.cloneElement(fallback, { onPress: () => setPaywall(true) })
        : (
          <TouchableOpacity onPress={() => setPaywall(true)} activeOpacity={0.85} style={pw.lockedRow}>
            <Feather name="lock" size={14} color="#f5a623" />
            <Text style={pw.lockedText}>Unlock with Gruvs Pro</Text>
            <Feather name="zap" size={13} color="#f5a623" />
          </TouchableOpacity>
        )}
      <Paywall visible={paywall} onClose={() => setPaywall(false)} highlight={feature} />
    </>
  );
};

const pw = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, padding: 18, paddingBottom: 26 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 20, fontWeight: '900' },
  sub: { fontSize: 12.5, marginTop: 6, marginBottom: 12, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 9, paddingHorizontal: 8 },
  feat: { fontSize: 13.5, fontWeight: '800' },
  blurb: { fontSize: 11.5, marginTop: 1, lineHeight: 15 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, paddingVertical: 14, borderRadius: 14 },
  ctaText: { color: '#000', fontSize: 14, fontWeight: '900', letterSpacing: 0.4 },
  lockedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245,166,35,0.4)', backgroundColor: 'rgba(245,166,35,0.08)' },
  lockedText: { color: '#f5a623', fontSize: 12, fontWeight: '800' },
});

export default Paywall;

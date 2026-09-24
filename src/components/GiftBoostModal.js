/**
 * GiftBoostModal — the storefront for the Tiered Gift System.
 *
 * Pick how far a promo should reach → the engine shows the cheapest gift that
 * covers it (scope-based pricing) → redeem with earned vibe_coins → that mints a
 * time-boxed ad token (the broadcast/advertising unlock). Shows the user's
 * balance and any boosts already active. Pure rules: src/services/giftAdEngine;
 * persistence: src/services/giftAdService.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { GIFT_TIERS, REACH_LEVELS, REACH_META } from '../constants/giftTiers';
import { requiredGiftForScope } from '../services/giftAdEngine';
import { getActiveAdTokens, redeemGiftForAds } from '../services/giftAdService';

const fmtLeft = (expiresAt) => {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)}d left`;
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(ms / 60000))}m left`;
};

export const GiftBoostModal = ({ visible, onClose, eventId = null }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || 'rgba(255,255,255,0.06)';

  const [reach, setReach] = useState('city');
  const [coins, setCoins] = useState(null);
  const [active, setActive] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase.from('profiles').select('vibe_coins').eq('id', user.id).maybeSingle();
      setCoins(Number(data?.vibe_coins || 0));
    } catch { setCoins(0); }
    setActive(await getActiveAdTokens(user.id));
  }, [user?.id]);

  useEffect(() => { if (visible) refresh(); }, [visible, refresh]);

  const required = requiredGiftForScope({ reach });

  const redeem = async (giftId) => {
    setError(''); setOkMsg(''); setBusyId(giftId);
    const res = await redeemGiftForAds(user?.id, giftId);
    if (res.ok) {
      setOkMsg('Boost unlocked! Your promo can now go live.');
      await refresh();
    } else {
      setError(res.error || 'Could not redeem.');
    }
    setBusyId(null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: bg }]}>
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={[s.title, { color: textColor }]}>Boost your reach</Text>
              <Text style={[s.sub, { color: muted }]}>Redeem a gift to unlock wider promotion.</Text>
            </View>
            <View style={[s.coins, { backgroundColor: `${primary}14`, borderColor: `${primary}40` }]}>
              <Text style={{ fontSize: 13 }}>🪙</Text>
              <Text style={[s.coinsText, { color: primary }]}>{coins == null ? '…' : coins}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginLeft: 10 }}>
              <Feather name="x" size={22} color={muted} />
            </TouchableOpacity>
          </View>

          {/* Reach selector */}
          <Text style={[s.label, { color: muted }]}>How far should it reach?</Text>
          <View style={s.reachRow}>
            {REACH_LEVELS.map(r => {
              const on = reach === r;
              return (
                <TouchableOpacity key={r} onPress={() => setReach(r)} activeOpacity={0.85}
                  style={[s.reachChip, { borderColor: on ? primary : 'rgba(255,255,255,0.12)', backgroundColor: on ? `${primary}1A` : surface }]}>
                  <Feather name={REACH_META[r]?.icon || 'circle'} size={12} color={on ? primary : muted} />
                  <Text style={[s.reachText, { color: on ? primary : muted }]}>{REACH_META[r]?.label || r}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 10, paddingVertical: 6 }} showsVerticalScrollIndicator={false}>
            {GIFT_TIERS.map(g => {
              const isRequired = g.id === required.gift.id;
              const affordable = coins != null && coins >= g.coinCost;
              const meetsReach = REACH_LEVELS.indexOf(g.reach) >= REACH_LEVELS.indexOf(reach);
              return (
                <View key={g.id} style={[s.tier, { borderColor: isRequired ? `${g.accent}` : 'rgba(255,255,255,0.10)', backgroundColor: surface }]}>
                  <Text style={{ fontSize: 26 }}>{g.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[s.tierName, { color: textColor }]}>{g.name}</Text>
                      {isRequired && <View style={[s.badge, { backgroundColor: `${g.accent}22` }]}><Text style={[s.badgeText, { color: g.accent }]}>BEST FOR THIS</Text></View>}
                    </View>
                    <Text style={[s.tierBlurb, { color: muted }]} numberOfLines={1}>{g.blurb}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => redeem(g.id)}
                    disabled={!meetsReach || !affordable || busyId != null}
                    activeOpacity={0.85}
                    style={[s.redeem, { backgroundColor: (meetsReach && affordable) ? primary : 'rgba(255,255,255,0.12)' }]}>
                    {busyId === g.id
                      ? <ActivityIndicator color="#000" size="small" />
                      : <Text style={[s.redeemText, { color: (meetsReach && affordable) ? '#000' : muted }]}>🪙 {g.coinCost}</Text>}
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>

          {!!error && <Text style={s.error}>{error}</Text>}
          {!!okMsg && <Text style={[s.ok, { color: primary }]}>{okMsg}</Text>}

          {active.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={[s.label, { color: muted }]}>Active boosts</Text>
              {active.map(t => (
                <View key={t.id} style={[s.activeRow, { borderColor: 'rgba(255,255,255,0.10)' }]}>
                  <Feather name="zap" size={13} color={primary} />
                  <Text style={[s.activeText, { color: textColor }]}>{REACH_META[t.reach]?.label || t.reach}</Text>
                  <Text style={[s.activeLeft, { color: muted }]}>{fmtLeft(t.expiresAt)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: Platform.OS === 'ios' ? 34 : 18 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 19, fontWeight: '900' },
  sub: { fontSize: 12.5, fontWeight: '500', marginTop: 2 },
  coins: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  coinsText: { fontSize: 14, fontWeight: '900' },
  label: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.4, marginBottom: 8, textTransform: 'uppercase' },
  reachRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  reachChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11, borderWidth: 1 },
  reachText: { fontSize: 12, fontWeight: '800' },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 15, padding: 12 },
  tierName: { fontSize: 14.5, fontWeight: '900' },
  tierBlurb: { fontSize: 11.5, fontWeight: '500', marginTop: 2 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  badgeText: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.4 },
  redeem: { minWidth: 64, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  redeemText: { fontSize: 13, fontWeight: '900' },
  error: { color: '#ef4444', fontSize: 12.5, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  ok: { fontSize: 12.5, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 12, marginTop: 8 },
  activeText: { fontSize: 13, fontWeight: '800', flex: 1 },
  activeLeft: { fontSize: 11.5, fontWeight: '700' },
});

export default GiftBoostModal;

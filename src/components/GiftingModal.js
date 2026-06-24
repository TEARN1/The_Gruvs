/**
 * GiftingModal.js
 * 
 * Interactive overlay tray for sending virtual gifts to creators/hosts.
 * Built with premium aesthetics (dark neon theme, glassmorphism, smooth animations).
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Image, Platform, Linking, Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { MonetizationService } from '../services/monetizationService';
import { GlassView } from './GlassView';
import { useToast } from './ToastNotification';

const { height: SH } = Dimensions.get('window');

export const GiftingModal = ({ visible, hostId, eventId, hostName, onClose, onGiftSent }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();

  const primary   = currentTheme?.primary || '#00f2ff';
  const bg        = currentTheme?.background || '#0d1112';
  const textColor = currentTheme?.text || '#fff';
  const muted     = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface   = currentTheme?.surface || 'rgba(255,255,255,0.06)';

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [coins, setCoins]     = useState(0);
  const [gifts, setGifts]     = useState([]);
  const [selectedGift, setSelectedGift] = useState(null);

  const loadBalanceAndGifts = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [userCoins, activeGifts] = await Promise.all([
        MonetizationService.getCoinBalance(user.id),
        MonetizationService.getActiveGifts()
      ]);
      setCoins(userCoins);
      setGifts(activeGifts);
      if (activeGifts.length > 0) {
        setSelectedGift(activeGifts[0]);
      }
    } catch {
      toast?.show('Could not load gift shop data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    if (visible) {
      loadBalanceAndGifts();
    }
  }, [visible, loadBalanceAndGifts]);

  const handleSendGift = async () => {
    if (!user?.id || !selectedGift || sending) return;

    if (coins < selectedGift.coin_cost) {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      toast?.show('Insufficient Coins! Tap "Top Up" to purchase more.', 'warning');
      return;
    }

    setSending(true);
    try {
      const res = await MonetizationService.sendGift(user.id, hostId, eventId, selectedGift.id);
      if (res.success) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
        toast?.show(`Sent ${selectedGift.name} successfully! ⚡`, 'success');
        setCoins(prev => prev - selectedGift.coin_cost);
        onGiftSent?.(selectedGift);
        onClose();
      } else {
        toast?.show(res.error || 'Failed to send gift.', 'error');
      }
    } catch {
      toast?.show('Network error while sending gift.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleTopUp = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    // Bypass App Store cuts by opening the web payment portal
    const checkoutUrl = `https://the-gruvs-pt23.vercel.app/buy-coins?uid=${user?.id || ''}`;
    Linking.openURL(checkoutUrl).catch(() => {
      toast?.show('Could not open payment portal.', 'error');
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.dismiss} onPress={onClose} activeOpacity={1} />
        
        <GlassView style={[s.card, { backgroundColor: `${bg}F2`, borderColor: `${primary}33` }]}>
          <View style={[s.handle, { backgroundColor: `${textColor}25` }]} />
          
          <View style={s.header}>
            <View>
              <Text style={[s.title, { color: textColor }]}>Send Gift to @{hostName || 'Host'}</Text>
              <Text style={[s.subtitle, { color: muted }]}>Your gift boosts their Lineup ranking!</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[s.closeBtn, { backgroundColor: surface }]}>
              <Feather name="x" size={18} color={textColor} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={s.loadingBox}>
              <ActivityIndicator color={primary} size="large" />
              <Text style={{ color: muted, marginTop: 10, fontSize: 13 }}>Loading gift vault...</Text>
            </View>
          ) : (
            <>
              <FlatList
                data={gifts}
                keyExtractor={(item) => item.id}
                numColumns={3}
                contentContainerStyle={s.listContent}
                renderItem={({ item }) => {
                  const isSelected = selectedGift?.id === item.id;
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                        setSelectedGift(item);
                      }}
                      style={[
                        s.giftCell,
                        { backgroundColor: surface, borderColor: isSelected ? primary : 'transparent' }
                      ]}
                      activeOpacity={0.8}
                    >
                      <View style={s.giftVisual}>
                        <Feather name={item.tier === 'legend' ? 'award' : item.tier === 'heat' ? 'zap' : 'heart'} size={32} color={isSelected ? primary : muted} />
                      </View>
                      <Text style={[s.giftName, { color: textColor }]} numberOfLines={1}>{item.name}</Text>
                      <View style={s.costTag}>
                        <Feather name="database" size={10} color={primary} style={{ marginRight: 3 }} />
                        <Text style={[s.giftCost, { color: primary }]}>{item.coin_cost}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />

              <View style={[s.footer, { borderTopColor: `${textColor}15` }]}>
                <View style={s.walletInfo}>
                  <Text style={[s.walletLabel, { color: muted }]}>Your Coins:</Text>
                  <View style={s.balanceRow}>
                    <Feather name="database" size={14} color={primary} style={{ marginRight: 5 }} />
                    <Text style={[s.balanceText, { color: textColor }]}>{coins}</Text>
                  </View>
                  <TouchableOpacity onPress={handleTopUp} style={s.topUpBtn}>
                    <Text style={[s.topUpText, { color: primary }]}>Top Up</Text>
                    <Feather name="chevron-right" size={12} color={primary} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[s.sendBtn, { backgroundColor: primary, opacity: sending ? 0.75 : 1 }]}
                  onPress={handleSendGift}
                  disabled={sending}
                  activeOpacity={0.85}
                >
                  {sending ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <Text style={s.sendBtnText}>Send {selectedGift?.name || 'Gift'}</Text>
                      <Feather name="send" size={14} color="#000" style={{ marginLeft: 6 }} />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </GlassView>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  dismiss: { flex: 1 },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: SH * 0.7,
    paddingTop: 10,
  },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 15 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, marginBottom: 15 },
  title: { fontSize: 16, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  loadingBox: { height: 260, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  giftCell: {
    flex: 1,
    aspectRatio: 1,
    margin: 6,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  giftVisual: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  giftName: { fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  costTag: { flexDirection: 'row', alignItems: 'center', marginTop: 4, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  giftCost: { fontSize: 11, fontWeight: '800' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderTopWidth: 1,
  },
  walletInfo: { flex: 1 },
  walletLabel: { fontSize: 11, fontWeight: '600' },
  balanceRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  balanceText: { fontSize: 18, fontWeight: '900' },
  topUpBtn: { flexDirection: 'row', alignItems: 'center' },
  topUpText: { fontSize: 12, fontWeight: '700', marginRight: 2 },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minWidth: 140,
  },
  sendBtnText: { color: '#000', fontSize: 14, fontWeight: '900' },
});

export default GiftingModal;

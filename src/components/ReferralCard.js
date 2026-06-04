import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Share,
  ActivityIndicator, Platform, Clipboard, Linking,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './ToastNotification';
import { GlassView } from './GlassView';
import { supabase } from '../services/supabase';
import { SecurityService } from '../services/securityService';

// When the app is published to stores, swap this to the App Store / Play Store URL.
// For now this points to the Expo Go project page so new users can install and open the app.
const APP_BASE_URL = 'https://thegruvs.com/join';

const generateReferralCode = (userId) => {
  if (!userId) return 'GRUV0000';
  return userId.replace(/-/g, '').slice(0, 8).toUpperCase();
};

const PLATFORMS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: 'message-square', color: "#25D366" },
  { id: 'twitter',  label: 'Twitter',  icon: 'twitter',        color: "#1DA1F2" },
  { id: 'copy',     label: 'Copy Link', icon: 'link',           color: "#8b5cf6" },
  { id: 'more',     label: 'More',      icon: 'share-2',        color: "#f59e0b" },
];

export const ReferralCard = ({ userId }) => {
  const { currentTheme } = useTheme();
  const toast = useToast();
  const [referralCount, setReferralCount] = useState(0);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);

  const primary   = currentTheme?.primary    || "#00f2ff";
  const surface   = currentTheme?.surface    || "#1a1f21";
  const textColor = currentTheme?.text       || "#ffffff";
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const referralCode = generateReferralCode(userId);
  const inviteLink   = `${APP_BASE_URL}?ref=${referralCode}`;
  const inviteMsg    = `@${username || 'me'} invited you to The Gruvs 🎉\n\nJoin the app where South Africa gruvs — discover events, connect with Vibers & live the culture.\n\n${inviteLink}`;

  const fetchReferralData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('username, referral_code, referral_count')
        .eq('id', userId)
        .single();

      if (data) {
        setReferralCount(data.referral_count || 0);
        setUsername(data.username || '');
        if (!data.referral_code) {
          supabase.from('profiles').update({ referral_code: referralCode }).eq('id', userId).then(() => {});
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [userId, referralCode]);

  useEffect(() => { fetchReferralData(); }, [fetchReferralData]);

  const copyLink = useCallback(async () => {
    try {
      if (Platform.OS === 'web' && navigator?.clipboard) {
        await navigator.clipboard.writeText(inviteLink);
      } else {
        Clipboard.setString(inviteLink);
      }
      toast?.show('Link copied!', 'success');
    } catch {
      toast?.show('Could not copy — share it manually.', 'error');
    }
  }, [inviteLink, toast]);

  const handlePlatform = useCallback(async (id) => {
    try {
      if (id === 'copy') { await copyLink(); return; }

      if (id === 'whatsapp') {
        const url = `whatsapp://send?text=${encodeURIComponent(inviteMsg)}`;
        const supported = await Linking.canOpenURL(url);
        if (supported) { await SecurityService.safeOpenURL(url); return; }
      }

      if (id === 'twitter') {
        await SecurityService.safeOpenURL(`https://twitter.com/intent/tweet?text=${encodeURIComponent(inviteMsg)}`);
        return;
      }

      await Share.share({ message: inviteMsg, title: 'Join The Gruvs' });
    } catch (e) {
      if (e?.message !== 'User did not share') {
        await Share.share({ message: inviteMsg, title: 'Join The Gruvs' });
      }
    }
  }, [inviteMsg, copyLink]);

  return (
    <GlassView style={rc.card}>
      {/* Header */}
      <View style={rc.topRow}>
        <Feather name="gift" size={18} color={primary} />
        <Text style={[rc.cardTitle, { color: textColor }]}>Invite Friends</Text>
        {referralCount > 0 && (
          <View style={[rc.badge, { backgroundColor: `${primary}20` }]}>
            <Feather name="users" size={10} color={primary} />
            <Text style={[rc.badgeText, { color: primary }]}>{referralCount} joined</Text>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={primary} style={{ marginVertical: 20 }} />
      ) : (
        <>
          {/* Designer QR — the user's name sits inside the code (high error
              correction keeps it scannable around the centre overlay). Scanning
              opens thegruvs.com/join?ref=… so the invited person signs up on the web. */}
          <View style={[rc.qrWrap, { backgroundColor: "#ffffff", borderColor: `${primary}40` }]}>
            <View style={rc.qrInner}>
              <QRCode
                value={inviteLink}
                size={200}
                color="#0d1112"
                backgroundColor="#ffffff"
                ecl="H"
                quietZone={6}
                centerLabel={`@${username || 'gruvs'}`}
                centerColor={primary}
              />
              {/* Centre name plate (native) — "name inside the QR". On web the
                  shim draws its own centred plate via centerLabel. */}
              {Platform.OS !== 'web' && (
                <View style={rc.qrCenter} pointerEvents="none">
                  <View style={[rc.qrNamePlate, { backgroundColor: primary }]}>
                    <Text style={rc.qrNameText} numberOfLines={1}>
                      @{username || 'gruvs'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
            <Text style={rc.qrLabel}>Scan to join {username ? `@${username}` : ''} on The Gruvs</Text>
            <View style={[rc.codeRow, { backgroundColor: `${primary}15`, borderColor: `${primary}35` }]}>
              <Text style={[rc.code, { color: primary }]}>{referralCode}</Text>
            </View>
          </View>

          {/* Share to platforms */}
          <Text style={[rc.shareTitle, { color: muted }]}>SHARE TO</Text>
          <View style={rc.platformRow}>
            {PLATFORMS.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[rc.platformBtn, { backgroundColor: `${p.color}15`, borderColor: `${p.color}30` }]}
                onPress={() => handlePlatform(p.id)}
                activeOpacity={0.75}
              >
                <Feather name={p.icon} size={16} color={p.color} />
                <Text style={[rc.platformLabel, { color: p.color }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Link preview */}
          <TouchableOpacity
            style={[rc.linkBox, { backgroundColor: `${primary}06`, borderColor: `${primary}20` }]}
            onPress={copyLink}
            activeOpacity={0.8}
          >
            <Feather name="link-2" size={13} color={muted} />
            <Text style={[rc.linkText, { color: muted }]} numberOfLines={1}>{inviteLink}</Text>
            <Feather name="copy" size={13} color={primary} />
          </TouchableOpacity>
        </>
      )}
    </GlassView>
  );
};

const rc = StyleSheet.create({
  card: { marginHorizontal: 16, marginVertical: 10, padding: 18, gap: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '900', flex: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  qrWrap: { alignItems: 'center', borderRadius: 20, borderWidth: 1, padding: 20, gap: 12 },
  qrInner: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  qrCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  qrNamePlate: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, borderWidth: 3, borderColor: '#ffffff', maxWidth: 120, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, elevation: 3 },
  qrNameText: { color: '#000', fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },
  qrLabel: { fontSize: 12, fontWeight: '700', color: "#0d1112" },
  codeRow: { paddingHorizontal: 20, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  code: { fontSize: 18, fontWeight: '900', letterSpacing: 4 },
  shareTitle: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  platformRow: { flexDirection: 'row', gap: 8 },
  platformBtn: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  platformLabel: { fontSize: 9, fontWeight: '800' },
  linkBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  linkText: { flex: 1, fontSize: 10, fontWeight: '600' },
});

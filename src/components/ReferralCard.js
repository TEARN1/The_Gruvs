import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Share,
  ActivityIndicator, Clipboard, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './ToastNotification';
import { GlassView } from './GlassView';
import { supabase } from '../services/supabase';

const generateReferralCode = (userId) => {
  if (!userId) return 'GRUV0000';
  return userId.replace(/-/g, '').slice(0, 8).toUpperCase();
};

export const ReferralCard = ({ userId }) => {
  const { currentTheme } = useTheme();
  const toast = useToast();
  const [referralCount, setReferralCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);

  const primary   = currentTheme?.primary    || '#00f2ff';
  const textColor = currentTheme?.text       || '#ffffff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const referralCode = generateReferralCode(userId);

  const fetchReferralData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('referral_code, referral_count')
        .eq('id', userId)
        .single();

      if (data) {
        setReferralCount(data.referral_count || 0);

        // Ensure referral_code is set on profile if missing
        if (!data.referral_code) {
          await supabase
            .from('profiles')
            .update({ referral_code: referralCode })
            .eq('id', userId);
        }
      }
    } catch (e) {
      console.log('ReferralCard fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [userId, referralCode]);

  useEffect(() => {
    fetchReferralData();
  }, [fetchReferralData]);

  const copyCode = useCallback(async () => {
    setCopying(true);
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(referralCode);
        } else {
          throw new Error('Clipboard API not available');
        }
      } else {
        Clipboard.setString(referralCode);
      }
      toast?.show('Referral code copied!', 'success');
    } catch {
      toast?.show('Could not copy code', 'error');
    } finally {
      setTimeout(() => setCopying(false), 800);
    }
  }, [referralCode, toast]);

  const shareInvite = useCallback(async () => {
    try {
      await Share.share({
        message: `Join me on The Gruvs — the social event app for people who actually go out. Use my code ${referralCode} when signing up! 🎉\n\nhttps://thegruvs.com/join?ref=${referralCode}`,
        title: 'Join The Gruvs',
      });
    } catch (e) {
      if (e.message !== 'User did not share') {
        toast?.show('Could not open share sheet', 'error');
      }
    }
  }, [referralCode, toast]);

  return (
    <GlassView style={rc.card}>
      <View style={rc.topRow}>
        <Feather name="gift" size={20} color={primary} />
        <Text style={[rc.cardTitle, { color: textColor }]}>Invite Friends</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={primary} style={{ marginVertical: 20 }} />
      ) : (
        <>
          <View style={[rc.codeBox, { borderColor: primary, backgroundColor: `${primary}12` }]}>
            <Text style={[rc.codeLabel, { color: primary }]}>YOUR REFERRAL CODE</Text>
            <Text style={[rc.code, { color: primary }]}>{referralCode}</Text>
          </View>

          <View style={rc.statsRow}>
            <Feather name="users" size={14} color={primary} />
            <Text style={[rc.statsText, { color: textColor }]}>
              <Text style={{ fontWeight: '900', color: primary }}>{referralCount}</Text>
              {' '}friend{referralCount === 1 ? '' : 's'} joined with your code
            </Text>
          </View>

          <View style={rc.buttonRow}>
            <TouchableOpacity
              style={[rc.btn, rc.btnOutline, { borderColor: primary }]}
              onPress={copyCode}
              activeOpacity={0.75}
            >
              <Feather name={copying ? 'check' : 'copy'} size={15} color={primary} />
              <Text style={[rc.btnText, { color: primary }]}>
                {copying ? 'Copied!' : 'Copy code'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[rc.btn, rc.btnFilled, { backgroundColor: primary }]}
              onPress={shareInvite}
              activeOpacity={0.8}
            >
              <Feather name="share-2" size={15} color="#000" />
              <Text style={[rc.btnText, { color: '#000' }]}>Share invite</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </GlassView>
  );
};

const rc = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 20,
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  codeBox: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 4,
  },
  codeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  code: { fontSize: 26, fontWeight: '900', letterSpacing: 4 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsText: { fontSize: 13 },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnOutline: { borderWidth: 1.5 },
  btnFilled: {},
  btnText: { fontSize: 13, fontWeight: '800' },
});

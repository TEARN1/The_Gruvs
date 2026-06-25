/**
 * EventContextualAds — Smart event-phase ad engine.
 * Shows relevant ads based on: pre_event / during_event / post_event phase.
 * Pulls real campaigns from Supabase `ad_campaigns` filtered by event + phase.
 * Pre-event:    transport, outfits, accommodation, pre-parties, dining
 * During event: food/drink, merch, photo booth, tips, upgrade offers
 * Post-event:   photos, reviews, next event early access, community, recap
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { adSlotActive } from '../constants/adConfig';
import { getEventPhaseKey, PHASE_META } from '../utils/eventPhase';
import { useAuth } from '../context/AuthContext';
import { useIdentity } from '../context/IdentityContext';
import { campaignMatchesViewer } from '../utils/campaignMatch';
import { supabase } from '../services/supabase';

// Phase + styling come from the shared event-phase engine (src/utils/eventPhase).
// The AdEngine is LIVE — it only surfaces real campaigns that businesses have
// booked against this event phase; no real campaign → the section renders nothing.

// ── Real Campaign Ad Tile (from Supabase) ─────────────────────────────────────
const CampaignAdTile = ({ campaign, phase, primary, textColor, muted, onNavigate }) => {
  const phaseColor = PHASE_META[phase]?.color || primary;
  const handleCtaPress = useCallback(async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    // Record click
    await supabase.from('campaign_analytics').insert({
      campaign_id: campaign.id,
      business_id: campaign.business_id,
      event_type: 'click',
      metadata: { phase },
    }).catch(() => {});
    if (campaign.cta_url && onNavigate) onNavigate(campaign.cta_url);
  }, [campaign, phase]);

  return (
    <View style={[eca.campaignTile, { borderColor: `${phaseColor}25`, backgroundColor: `${phaseColor}06` }]}>
      <View style={[eca.campSponsoredBadge, { backgroundColor: `${phaseColor}18` }]}>
        <Text style={[eca.campSponsoredText, { color: phaseColor }]}>PROMOTED</Text>
      </View>
      {campaign.headline ? <Text style={[eca.campHeadline, { color: textColor }]}>{campaign.headline}</Text> : null}
      {campaign.subline ? <Text style={[eca.campSubline, { color: muted }]}>{campaign.subline}</Text> : null}
      <TouchableOpacity onPress={handleCtaPress} style={[eca.campCta, { backgroundColor: phaseColor }]} activeOpacity={0.8}>
        <Text style={eca.campCtaText}>{campaign.cta_text || 'Learn More'}</Text>
        <Feather name="arrow-right" size={10} color="#000" />
      </TouchableOpacity>
    </View>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const EventContextualAds = ({ event, onNavigate, slot = 'eventDetail' }) => {
  const { currentTheme }    = useTheme();
  const { user }            = useAuth();
  const { identityMode }    = useIdentity();
  const primary   = currentTheme?.primary    || "#00f2ff";
  const textColor = currentTheme?.text       || "#ffffff";
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const [phase, setPhase]               = useState('pre_event');
  const [campaigns, setCampaigns]       = useState([]);
  const fadeAnim                        = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (identityMode === 'celebrity' || !adSlotActive(slot)) return;
    const p = getEventPhaseKey(event);
    setPhase(p);
    fetchCampaigns(p);
  }, [event?.id]);

  const fetchCampaigns = async (p) => {
    if (!event?.id) return;
    try {
      const { data } = await supabase
        .from('ad_campaigns')
        .select('*')
        .eq('status', 'active')
        .contains('targeting->event_phases', [p])
        .order('created_at', { ascending: false })
        .limit(20);

      // Apply the audience targeting the business set (delivery already filtered
      // by phase) — only viewers who match see the ad, and only they get billed
      // an impression. Without this the targeting is decorative.
      let viewer = {};
      if (user?.id) {
        try {
          const { data: vp } = await supabase
            .from('profiles')
            .select('city, gender, interests, birth_year, age')
            .eq('id', user.id).maybeSingle();
          viewer = vp || {};
        } catch { /* unknown viewer → only known-mismatches get filtered */ }
      }
      const matched = (data || [])
        .filter(c => campaignMatchesViewer(c.targeting, viewer, event))
        .slice(0, 3);

      if (matched.length > 0) {
        setCampaigns(matched);
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        // Record impressions — only for ads actually shown to a matching viewer
        await Promise.all(matched.map(c =>
          supabase.from('campaign_analytics').insert({ campaign_id: c.id, business_id: c.business_id, event_type: 'impression', metadata: { phase: p, event_id: event.id } }).then(() => {}).catch(() => {})
        ));
      }
    } catch {}
  };

  // Celebrity mode = no ads; also respect the central ad-slot control (checked after hooks)
  if (identityMode === 'celebrity' || !adSlotActive(slot)) return null;

  const phaseConfig = PHASE_META[phase];
  // LIVE-ONLY: nothing to show until a real business books a campaign for this phase.
  if (!phaseConfig || campaigns.length === 0) return null;

  const phaseColor = phaseConfig.color;

  return (
    <Animated.View style={[eca.container, { opacity: fadeAnim }]}>
      {/* Phase header */}
      <View style={eca.phaseHeader}>
        <View style={[eca.phaseIconWrap, { backgroundColor: `${phaseColor}18` }]}>
          <Feather name={phaseConfig.icon} size={14} color={phaseColor} />
        </View>
        <Text style={[eca.phaseLabel, { color: phaseColor }]}>{phaseConfig.label}</Text>
        <Text style={[eca.phaseCount, { color: muted }]}>{campaigns.length} live</Text>
      </View>

      {/* Real campaigns — booked by actual businesses */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 4, gap: 10, paddingRight: 4 }} style={{ marginBottom: 10 }}>
        {campaigns.map(c => (
          <CampaignAdTile key={c.id} campaign={c} phase={phase} primary={primary} textColor={textColor} muted={muted} onNavigate={onNavigate} />
        ))}
      </ScrollView>

      <Text style={[eca.disclaimer, { color: muted }]}>Sponsored Missions · The Gruvs AdEngine</Text>
    </Animated.View>
  );
};

const eca = StyleSheet.create({
  container: { marginHorizontal: 16, marginVertical: 8 },
  phaseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  phaseIconWrap: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  phaseLabel: { flex: 1, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  phaseCount: { fontSize: 9, fontWeight: '700' },
  // Campaign tiles (horizontal scroll)
  campaignTile: { width: 220, padding: 14, borderRadius: 14, borderWidth: 1 },
  campSponsoredBadge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, marginBottom: 8 },
  campSponsoredText: { fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  campHeadline: { fontSize: 13, fontWeight: '900', marginBottom: 4 },
  campSubline: { fontSize: 11, lineHeight: 15, marginBottom: 10 },
  campCta: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9 },
  campCtaText: { color: '#000', fontSize: 10, fontWeight: '900' },
  disclaimer: { fontSize: 8, textAlign: 'right', opacity: 0.5, marginTop: 2 },
});

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
import { useAuth } from '../context/AuthContext';
import { useIdentity } from '../context/IdentityContext';
import { supabase } from '../services/supabase';

// ── Phase definitions ─────────────────────────────────────────────────────────
const PHASE_CONFIG = {
  pre_event: {
    label:   'BEFORE THE GRUV',
    icon:    'clock',
    color:   '#8b5cf6',
    categories: [
      { icon: 'truck',       label: 'Lock Your Ride',     body: 'Book your transport. Uber, Bolt, and charter drivers near the Spot.',       cta: 'Book Ride' },
      { icon: 'shopping-bag',label: 'What to Rock',       body: 'Find outfits perfect for this vibe. Local brands dropping near you.',       cta: 'Shop Looks' },
      { icon: 'home',        label: 'Stay Sorted',        body: "Staying over? Hotels, Airbnbs, and guesthouses close to the Spot.",          cta: 'Find a Stay' },
      { icon: 'music',       label: 'Pre-Gruvs',          body: 'Warm-up sessions and pre-drinks dropping before the main Gruv.',            cta: 'See Pre-Gruvs' },
      { icon: 'coffee',      label: 'Feed Before',        body: 'Top restaurants and bars near the Spot. Reserve before it fills up.',       cta: 'Reserve a Table' },
      { icon: 'camera',      label: 'Personal Shots',     body: 'Lock in a photographer for content. Limited slots — move fast.',            cta: 'Book Photographer' },
      { icon: 'gift',        label: 'Pre-order Merch',    body: 'Pre-order exclusive Gruv merch. Collect at the door on arrival.',           cta: 'Pre-order' },
      { icon: 'shield',      label: 'Cover Yourself',     body: 'Protect your night. Cancel cover from R25.',                                cta: 'Get Cover' },
    ],
  },
  during_event: {
    label:   'IN THE GRUV',
    icon:    'zap',
    color:   '#00f2ff',
    categories: [
      { icon: 'coffee',      label: 'Food & Drinks',      body: "See what's dropping at the bar and food stalls. Skip the queue.",           cta: 'Order Now' },
      { icon: 'package',     label: 'Merch Drop',         body: 'Limited edition Gruv merch on sale right now. Tees, caps, prints.',         cta: 'Shop Merch' },
      { icon: 'camera',      label: 'Shot Booth',         body: 'Professional shot booth on-site. Get your shots locked in 5 minutes.',     cta: 'Book Slot' },
      { icon: 'star',        label: 'Royale Upgrade',     body: 'Upgrade to Royale access — better view, exclusive lounge, free drinks.',    cta: 'Go Royale' },
      { icon: 'map-pin',     label: 'Gruv Map',           body: 'Find stages, bathrooms, first aid, and exits. See the full layout.',       cta: 'View Map' },
      { icon: 'users',       label: 'Meet Vibers',        body: 'See who else Touched Down and link up. Vibers nearby with shared taste.',   cta: 'Connect' },
      { icon: 'gift',        label: 'Lucky Draw',         body: 'Enter the lucky draw happening at 10pm. Prizes worth R5,000+.',            cta: 'Enter Now' },
    ],
  },
  post_event: {
    label:   'POST GRUV',
    icon:    'star',
    color:   '#10b981',
    categories: [
      { icon: 'camera',      label: 'Your Shots',         body: 'Professional Gruv shots are live. Find yourself and download instantly.',   cta: 'Find My Shots' },
      { icon: 'star',        label: 'Rate the Gruv',      body: 'Help the community. Rate the Gruv and Echo your experience.',              cta: 'Rate Gruv' },
      { icon: 'video',       label: 'Highlight Reel',     body: 'The official recap is out. Watch and Drop the best moments.',              cta: 'Watch Recap' },
      { icon: 'calendar',    label: 'Next Gruv',          body: "The organiser's next Gruv is live. Early bird Passes dropping now.",        cta: 'Early Bird' },
      { icon: 'users',       label: 'Lock Into the Crew', body: 'Connect with Vibers who Touched Down. WhatsApp and Discord waiting.',       cta: 'Join Crew' },
      { icon: 'truck',       label: 'Get Home Safe',      body: 'Late night transport still running from the Spot.',                         cta: 'Book Ride Home' },
      { icon: 'coffee',      label: 'Post-Gruv Eats',     body: "Late-night Spots still open near the venue. Keep the night alive.",        cta: 'Find Food' },
    ],
  },
};

// ── Determine phase from event date/time ──────────────────────────────────────
const getPhase = (eventDateStr) => {
  if (!eventDateStr) return 'pre_event';
  const now       = new Date();
  const eventDate = new Date(eventDateStr);
  const diffHours = (eventDate - now) / (1000 * 60 * 60);
  if (diffHours > 3)   return 'pre_event';
  if (diffHours > -6)  return 'during_event';
  return 'post_event';
};

// ── Single Ad Tile ────────────────────────────────────────────────────────────
const AdTile = ({ ad, color, primary, textColor, muted, fadeAnim, onDismiss, onCta }) => (
  <Animated.View style={[eca.adTile, { opacity: fadeAnim, borderColor: `${color}30`, backgroundColor: `${color}06` }]}>
    <View style={eca.adTileHeader}>
      <View style={[eca.adTileIconWrap, { backgroundColor: `${color}20` }]}>
        <Feather name={ad.icon || 'zap'} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[eca.adTileLabel, { color: textColor }]}>{ad.label}</Text>
        <Text style={[eca.adTileBody, { color: muted }]} numberOfLines={2}>{ad.body}</Text>
      </View>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Feather name="x" size={12} color={muted} />
        </TouchableOpacity>
      )}
    </View>
    <TouchableOpacity onPress={onCta} style={[eca.adTileCta, { backgroundColor: color }]} activeOpacity={0.8}>
      <Text style={eca.adTileCtaText}>{ad.cta}</Text>
      <Feather name="arrow-right" size={10} color="#000" />
    </TouchableOpacity>
  </Animated.View>
);

// ── Real Campaign Ad Tile (from Supabase) ─────────────────────────────────────
const CampaignAdTile = ({ campaign, phase, primary, textColor, muted, onNavigate }) => {
  const phaseColor = PHASE_CONFIG[phase]?.color || primary;
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
export const EventContextualAds = ({ event, onNavigate }) => {
  const { currentTheme }    = useTheme();
  const { user }            = useAuth();
  const { identityMode }    = useIdentity();
  const primary   = currentTheme?.primary    || '#00f2ff';
  const textColor = currentTheme?.text       || '#ffffff';
  const muted     = currentTheme?.textMuted  || 'rgba(255,255,255,0.5)';

  const [phase, setPhase]               = useState('pre_event');
  const [dismissed, setDismissed]       = useState([]);
  const [campaigns, setCampaigns]       = useState([]);
  const [expanded, setExpanded]         = useState(false);
  const fadeAnim                        = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (identityMode === 'celebrity') return;
    const p = getPhase(event?.date_time || event?.date);
    setPhase(p);
    fetchCampaigns(p);
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
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
        .limit(3);
      if (data?.length > 0) {
        setCampaigns(data);
        // Record impressions
        await Promise.all(data.map(c =>
          supabase.from('campaign_analytics').insert({ campaign_id: c.id, business_id: c.business_id, event_type: 'impression', metadata: { phase: p, event_id: event.id } }).catch(() => {})
        ));
      }
    } catch {}
  };

  // Celebrity mode = no ads (checked after hooks)
  if (identityMode === 'celebrity') return null;

  const phaseConfig = PHASE_CONFIG[phase];
  if (!phaseConfig) return null;

  const phaseColor    = phaseConfig.color;
  const allCategories = phaseConfig.categories;
  const visible       = allCategories.filter(a => !dismissed.includes(a.label));
  const shown         = expanded ? visible : visible.slice(0, 2);

  if (visible.length === 0 && campaigns.length === 0) return null;

  return (
    <Animated.View style={[eca.container, { opacity: fadeAnim }]}>
      {/* Phase header */}
      <View style={eca.phaseHeader}>
        <View style={[eca.phaseIconWrap, { backgroundColor: `${phaseColor}18` }]}>
          <Feather name={phaseConfig.icon} size={14} color={phaseColor} />
        </View>
        <Text style={[eca.phaseLabel, { color: phaseColor }]}>{phaseConfig.label}</Text>
        <Text style={[eca.phaseCount, { color: muted }]}>{visible.length} drops</Text>
      </View>

      {/* Real campaign ads first */}
      {campaigns.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 4, gap: 10, paddingRight: 4 }} style={{ marginBottom: 10 }}>
          {campaigns.map(c => (
            <CampaignAdTile key={c.id} campaign={c} phase={phase} primary={primary} textColor={textColor} muted={muted} onNavigate={onNavigate} />
          ))}
        </ScrollView>
      )}

      {/* Phase category tiles */}
      {shown.map(ad => (
        <AdTile
          key={ad.label}
          ad={ad}
          color={phaseColor}
          primary={primary}
          textColor={textColor}
          muted={muted}
          fadeAnim={fadeAnim}
          onDismiss={() => setDismissed(p => [...p, ad.label])}
          onCta={() => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}; onNavigate?.(ad.label); }}
        />
      ))}

      {visible.length > 2 && (
        <TouchableOpacity onPress={() => setExpanded(e => !e)} style={[eca.showMoreBtn, { borderColor: `${phaseColor}30` }]}>
          <Text style={[eca.showMoreText, { color: phaseColor }]}>
            {expanded ? 'Show less' : `+${visible.length - 2} more ${phaseConfig.label.toLowerCase()} offers`}
          </Text>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={12} color={phaseColor} />
        </TouchableOpacity>
      )}

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
  adTile: { borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8 },
  adTileHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  adTileIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  adTileLabel: { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  adTileBody: { fontSize: 11, lineHeight: 15 },
  adTileCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10 },
  adTileCtaText: { color: '#000', fontSize: 10, fontWeight: '900' },
  // Campaign tiles (horizontal scroll)
  campaignTile: { width: 220, padding: 14, borderRadius: 14, borderWidth: 1 },
  campSponsoredBadge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, marginBottom: 8 },
  campSponsoredText: { fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  campHeadline: { fontSize: 13, fontWeight: '900', marginBottom: 4 },
  campSubline: { fontSize: 11, lineHeight: 15, marginBottom: 10 },
  campCta: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9 },
  campCtaText: { color: '#000', fontSize: 10, fontWeight: '900' },
  // Show more
  showMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  showMoreText: { fontSize: 11, fontWeight: '700' },
  disclaimer: { fontSize: 8, textAlign: 'right', opacity: 0.5, marginTop: 2 },
});

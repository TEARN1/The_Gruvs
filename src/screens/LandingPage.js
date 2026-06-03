import React, { useState, useEffect, useRef, useCallback, useMemo, startTransition } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TouchableWithoutFeedback, Image,
  Animated, Linking, RefreshControl, ScrollView, TextInput,
  Share, Modal, Platform, ActivityIndicator, Dimensions, BackHandler,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastNotification';
import { GlassView } from '../components/GlassView';
import { MediaViewer } from '../components/MediaViewer';
import { MatchVersus, parseMatchCard } from '../components/MatchVersus';
import { SmartImage } from '../components/SmartImage';
import { FadeInView } from '../components/FadeInView';
import { BrandLogo } from '../components/BrandLogo';
import { OfflineBanner } from '../components/OfflineBanner';
import { SearchHistoryBar, saveSearch } from '../components/SearchHistoryBar';
import { DateFilterStrip, dateFilterToRange } from '../components/DateFilterStrip';
import { HashtagStrip } from '../components/HashtagStrip';
import { useIdentity } from '../context/IdentityContext';
import { SafeSection } from '../components/SafeSection';
import { supabase, isSupabaseEnabled } from '../services/supabase';
import { thumb } from '../utils/storageThumb';
import { SecurityService } from '../services/securityService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShakeDetector, RichHaptics } from '../services/smartphoneFeatures';
import { FeedManager, TrendingManager, VibeManager, BookmarkManager, FollowingFeedManager, ScoreEngine, CAT_KEY_TO_SUBCATS, isOnline as checkOnline } from '../services/dataFlow';
import { resilient } from '../utils/resilience';
import { RouteEngine } from '../services/routeEngine';
import { CATEGORY_CONFIG, CATEGORY_KEYS, getCategoryColor, REACTION_LIST } from '../constants/CategoryConfig';
import { FONT, RADIUS } from '../constants/DesignTokens';
import { SkeletonCard as SkeletonCardImported } from '../components/SkeletonCard';
import { CommunityStatsBar } from '../components/CommunityStatsBar';
import { TonightAlert } from '../components/TonightAlert';
import { StoriesRow } from '../components/StoriesRow';
import { FriendActivityFeed } from '../components/FriendActivityFeed';
import { AuraEffect } from '../components/AuraEffect';
import { LiquidBackground } from '../components/LiquidBackground';
import { AnimatedCounter } from '../components/Motion';
import { haptics } from '../utils/haptics';
import { CrewJourneyPanel } from '../components/CrewJourneyPanel';
import { ReturnPathCard } from '../components/ReturnPathCard';
import { PresenceBar } from '../components/PresenceBar';
import { AdFlywheel } from '../components/AdFlywheel';
import { EchoSection } from '../components/EchoSection';
import { RatingSection } from '../components/RatingSection';
import { PulseScheduleSection } from '../components/PulseScheduleSection';
import { EventGallery } from '../components/EventGallery';
import { ReactPicker } from '../components/ReactPicker';
import { SuggestedFollows } from '../components/SuggestedFollows';
import { ReactedBadge } from '../components/ReactionFX';

// ── Static imports (no lazy — avoids "unknown module" chunk failures on web) ──
import { PostEventModal }       from '../components/PostEventModal';
import { PersonalPlannerModal } from '../components/PersonalPlannerModal';
import { ViberProfileModal }    from '../components/ViberProfileModal';
import { ActivityCenterModal }  from '../components/ActivityCenterModal';
import { EventAdminPanel }      from '../components/EventAdminPanel';
import { EditEventModal }       from '../components/EditEventModal';
import { RSVPConfirmModal }     from '../components/RSVPConfirmModal';
import { ReportModal }          from '../components/ReportModal';
import { EventMapView }         from '../components/EventMapView';
import { PathMapScreen }        from './PathMapScreen';
import { EventDetailScreen }    from './EventDetailScreen';

const SCREEN_W = Dimensions.get('window').width;
const TREND_CARD_W = Math.min(210, SCREEN_W * 0.56);
const TREND_CARD_H = Math.round(TREND_CARD_W * 0.62);

// Safe haptic wrapper for web compatibility
const safeHaptic = (fn) => {
  if (Platform.OS === 'web') return;
  try { fn(); } catch {}
};

// ── Skeleton card shown while loading ─────────────────────────────────────────
const AVATAR_COLORS = ["#0891b2", "#7c3aed", "#dc2626", "#059669", "#d97706", "#db2777"];
const AvatarStack = ({ count, size = 20 }) => {
  if (!count || count === 0) return null;
  const displayCount = Math.min(3, count);
  return (
    <View style={styles.avatarStack}>
      {[...Array(displayCount)].map((_, i) => (
        <View
          key={i}
          style={[
            styles.stackAvatar,
            { width: size, height: size, borderRadius: size / 2, marginLeft: i === 0 ? 0 : -size / 2, borderColor: '#000', backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length], alignItems: 'center', justifyContent: 'center' }
          ]}
        >
          <Text style={{ fontSize: size * 0.45, fontWeight: '900', color: '#fff' }}>V</Text>
        </View>
      ))}
      {count > displayCount && (
        <View style={[styles.stackMore, { width: size, height: size, borderRadius: size / 2, marginLeft: -size / 2, backgroundColor: '#222', borderColor: '#000' }]}>
          <Text style={styles.stackMoreText}>+{count - displayCount}</Text>
        </View>
      )}
    </View>
  );
};

const SkeletonCard = ({ primary }) => {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[skStyles.card, { opacity: pulse, borderColor: `${primary}30` }]}>
      <View style={[skStyles.media, { backgroundColor: `${primary}12` }]} />
      <View style={skStyles.body}>
        <View style={[skStyles.avatar, { backgroundColor: `${primary}20` }]} />
        <View style={{ flex: 1, gap: 10 }}>
          <View style={[skStyles.line, { width: '70%', backgroundColor: `${primary}25`, height: 14 }]} />
          <View style={[skStyles.line, { width: '45%', backgroundColor: `${primary}15`, height: 10 }]} />
        </View>
      </View>
      <View style={[skStyles.line, { width: '90%', backgroundColor: `${primary}18`, marginHorizontal: 16, marginBottom: 12, height: 12 }]} />
      <View style={[skStyles.line, { width: '75%', backgroundColor: `${primary}10`, marginHorizontal: 16, marginBottom: 20, height: 10 }]} />
    </Animated.View>
  );
};

const skStyles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 20, borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  media: { height: 200 },
  body: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  line: { height: 10, borderRadius: 6 },
});

// ── Visitor banner ─────────────────────────────────────────────────────────────
// Item 57: accessible sign-in prompt
const VisitorBanner = ({ onSignIn, primary, muted }) => (
  <TouchableOpacity
    style={[vb.wrap, { backgroundColor: `${primary}10`, borderColor: `${primary}30` }]}
    onPress={onSignIn}
    activeOpacity={0.8}
    accessibilityRole="button"
    accessibilityLabel="Sign in to RSVP, react and post events"
  >
    <Feather name="user" size={15} color={primary} />
    <Text style={[vb.text, { color: muted }]}>
      Browsing as guest — <Text style={{ color: primary, fontWeight: '800' }}>sign in</Text> to RSVP, react & post
    </Text>
    <Feather name="chevron-right" size={14} color={`${primary}80`} />
  </TouchableOpacity>
);

const vb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  text: { flex: 1, fontSize: 12, lineHeight: 17 },
});

// ── Trending "See All" full-screen modal ───────────────────────────────────────
const TrendingModal = ({ visible, onClose, trending, primary, bg, textColor, muted, onSelectEvent }) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={[tm.overlay, { backgroundColor: `${bg}ee` }]}>
      <View style={[tm.header, { borderBottomColor: `${primary}20` }]}>
        <Text style={[tm.title, { color: textColor }]}>Trending Gruvs</Text>
        <TouchableOpacity onPress={onClose} style={tm.closeBtn}>
          <Feather name="x" size={22} color={textColor} />
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 10 }}>
        {trending.map((spot, i) => (
          // Item 59: accessible trending row
          <TouchableOpacity
            key={spot.event_id || i}
            style={[tm.row, { borderColor: `${primary}18` }]}
            onPress={() => { onClose(); onSelectEvent && onSelectEvent(spot); }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Trending #${i + 1}: ${spot.description || spot.title || 'Trending Gruv'}, ${spot.rsvp_count || spot.going || 0} vibing`}
          >
            <Image
              source={typeof spot.image === 'string' ? { uri: spot.image } : (spot.image || require('../../assets/events/pixel.png'))}
              style={tm.thumb}
            />
            <View style={{ flex: 1 }}>
              <View style={tm.rankRow}>
                <View style={[tm.rankBadge, { backgroundColor: i < 3 ? `${primary}25` : 'rgba(255,255,255,0.06)' }]}>
                  <Text style={[tm.rankNum, { color: i < 3 ? primary : muted }]}>#{i + 1}</Text>
                </View>
                <Text style={[tm.spotName, { color: textColor }]} numberOfLines={1}>
                  {spot.description || spot.title || 'Trending Gruv'}
                </Text>
              </View>
              <View style={tm.metaRow}>
                <Feather name="zap" size={11} color={primary} />
                <Text style={[tm.metaText, { color: muted }]}>{spot.rsvp_count || spot.going || 0} vibing</Text>
                {spot.address ? (
                  <>
                    <Feather name="map-pin" size={11} color={muted} style={{ marginLeft: 8 }} />
                    <Text style={[tm.metaText, { color: muted }]} numberOfLines={1}>{spot.address}</Text>
                  </>
                ) : null}
              </View>
            </View>
            <Feather name="chevron-right" size={16} color={`${primary}60`} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  </Modal>
);

const tm = StyleSheet.create({
  overlay: { flex: 1, marginTop: 80, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  closeBtn: { padding: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 10 },
  thumb: { width: 70, height: 70, borderRadius: 12 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  rankBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  rankNum: { fontSize: 11, fontWeight: '900' },
  spotName: { fontSize: 14, fontWeight: '800', flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11 },
});

// ── Memoized EventCard Component for FlatList ────────────────────────────────
const EventCard = React.memo(({
  event,
  index,
  user,
  primary,
  surface,
  textColor,
  muted,
  isVibed,
  vibeCounts,
  isSaved,
  userReaction,
  crewCount,
  isHighlighted,
  flashColor,
  isRoute,
  isFollowing,
  checkins,
  onAuthRequired,
  onNavigateToServices,
  onSelectEvent,
  onEditEvent,
  onAdminEvent,
  onRsvpEvent,
  onReportTarget,
  onSetReactorsEvent,
  onFetchCheckins,
  onOpenViberProfile,
  onFollow,
  onImageTap,
  onImageLongPress,
  onCardPressIn,
  onCardPressOut,
  scaleValue,
  heartAnim,
  openSection,
  onVibe,
  onBookmark,
  onReact,
  onShare,
  onToggleRoute,
  onToggleSection,
}) => {
  const id = event.id;
  const isSample = event.is_sample === true;
  const isOwner = user && event.author_id === user.id;
  const catColor = event.category_color || getCategoryColor(event.category) || primary;
  const title = event.title || event.description?.split('.')[0] || 'Upcoming Gruv';
  const matchCard = parseMatchCard(event.match_card);
  const goingPct = event.capacity ? Math.min(100, Math.round(((event.going || 0) / event.capacity) * 100)) : 0;

  const getCountdown = (dateStr) => {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86400000);
    const hrs = Math.floor((diff % 86400000) / 3600000);
    return days > 0 ? `${days}d ${hrs}h` : `${hrs}h away`;
  };
  const countdown = getCountdown(event.event_date);
  const isWeb = Platform.OS === 'web';
  const cardDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const showAd = index > 0 && index % 5 === 4;

  return (
    <React.Fragment>
      <FadeInView delay={Math.min(index, 5) * 60} direction="up">
        <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
        <View
          style={[
            styles.eventCard,
            {
              backgroundColor: flashColor ? `${flashColor}12` : surface,
              borderColor: flashColor ? flashColor : isHighlighted ? primary : `${primary}25`,
              borderTopColor: flashColor ? flashColor : isHighlighted ? primary : `${primary}40`,
              borderTopWidth: flashColor ? 2 : 1,
            },
            (isHighlighted || flashColor) && {
              borderWidth: 2,
              ...(isWeb ? { boxShadow: `0 0 25px ${(flashColor || primary)}80` } : { shadowColor: flashColor || primary, shadowOpacity: 0.6, shadowRadius: 16, elevation: 12 })
            },
            isWeb && !flashColor && { boxShadow: '0 12px 40px rgba(0,0,0,0.6)' },
            isWeb && flashColor && { transition: 'border-color 0.5s ease, background-color 0.5s ease, box-shadow 0.5s ease' },
            isWeb && { cursor: 'pointer' },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${title}${cardDate ? ', ' + cardDate : ''}${event.venue_name ? ', at ' + event.venue_name : ''}`}
          {...(isWeb ? {
            className: 'event-card',
            tabIndex: 0,
            onKeyPress: (e) => e.nativeEvent?.key === 'Enter' && onSelectEvent(event),
          } : {})}
        >

          {/* Trending crown banner */}
          {event._isTrending && (
            <View style={[styles.trendingBanner, { backgroundColor: primary }]}>
              <Text style={styles.trendingBannerText}>
                🔥 #{event._trendingRank} TRENDING NOW
              </Text>
            </View>
          )}

          {/* Recurring series banner */}
          {event.is_recurring && !event._isTrending && (
            <View style={[styles.trendingBanner, { backgroundColor: "#6366f1" }]}>
              <Feather name="repeat" size={10} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.trendingBannerText}>
                {event.recurrence_type === 'weekly'   ? 'WEEKLY SERIES' :
                 event.recurrence_type === 'monthly'  ? 'MONTHLY SERIES' :
                 event.recurrence_type === 'annually' ? 'ANNUAL EVENT' :
                 event.recurrence_type === 'custom'   ? 'EVENT SERIES' : 'RECURRING'}
                {event.next_occurrence ? ` · NEXT ${new Date(event.next_occurrence).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }).toUpperCase()}` : ''}
              </Text>
            </View>
          )}

          {/* AI-routed personalisation badge */}
          {event._aiRecommended && !event._isTrending && !event.is_recurring && (
            <View style={[styles.trendingBanner, { backgroundColor: "#7c3aed" }]}>
              <Text style={styles.trendingBannerText}>✦ MATCHED TO YOUR VIBE</Text>
            </View>
          )}

          {/* Media — double-tap to vibe, long-press for quick actions */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => onImageTap(event)}
            onPressIn={() => onCardPressIn(id)}
            onPressOut={() => onCardPressOut(id)}
            onLongPress={() => onImageLongPress(event)}
            delayLongPress={400}
          >
          {matchCard ? (
            <View style={[styles.imgSection, { backgroundColor: '#0b0e0f' }, isWeb && { aspectRatio: '2/1' }]}>
              <MatchVersus match={matchCard} height={isWeb ? 200 : 168} isWeb={isWeb} />
              {event.category && (
                <View style={[styles.catBadge, { backgroundColor: `${catColor}22`, borderColor: `${catColor}55` }, isWeb && { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }]}>
                  <Text style={[styles.catBadgeText, { color: catColor }]}>{(CATEGORY_CONFIG[event.category]?.label || event.category).toUpperCase()}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.bookmarkBtn, { backgroundColor: isSaved ? `${primary}40` : 'rgba(0,0,0,0.5)' }]}
                onPress={(e) => { e.stopPropagation?.(); onBookmark(id); }}
                accessibilityRole="button"
                accessibilityLabel={isSaved ? `Remove bookmark: ${title}` : `Bookmark event: ${title}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="bookmark" size={15} color={isSaved ? primary : '#fff'} />
              </TouchableOpacity>
            </View>
          ) : (
          <View style={[styles.imgSection, { backgroundColor: `${catColor}18` }, isWeb && { aspectRatio: '2/1' }]}>
            <MediaViewer aspectRatio={2} media={(() => {
              let m = event.media;
              if (!m?.length && event.media_urls?.length) {
                m = event.media_urls.map(u => ({ url: u, type: /\.(mp4|mov|m4v|webm)/i.test(u) ? 'video' : 'image' }));
              }
              if (!m?.length && event.cover_url) m = [{ url: event.cover_url, type: 'image' }];
              if (!m?.length && event.cover_image) m = [{ url: event.cover_image, type: 'image' }];
              if (!m?.length && event.image_url) m = [{ url: event.image_url, type: 'image' }];
              return m?.length ? m : null;
            })()} />
            {/* Double-tap heart burst overlay */}
            {heartAnim && (
              <Animated.View pointerEvents="none" style={{
                ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center',
                opacity: heartAnim.opacity,
                transform: [{ scale: heartAnim.scale }],
              }}>
                <Text style={{ fontSize: 72 }}>❤️</Text>
              </Animated.View>
            )}
            {/* Item 48: vignette gradient */}
            <View style={{
              ...StyleSheet.absoluteFillObject,
              ...(isWeb
                ? { backgroundImage: 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.65) 100%)' }
                : { backgroundColor: 'rgba(0,0,0,0.15)' }
              ),
            }} />
            {/* Item 52: glassmorphic category badge */}
            {event.category && (
              <View style={[
                styles.catBadge,
                { backgroundColor: `${catColor}22`, borderColor: `${catColor}55` },
                isWeb && { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' },
              ]}>
                <Text style={[styles.catBadgeText, { color: catColor }]}>
                  {(CATEGORY_CONFIG[event.category]?.label || event.category).toUpperCase()}
                </Text>
              </View>
            )}
            {/* Bookmark — separate touch target, stops propagation to image tap */}
            <TouchableOpacity
              style={[styles.bookmarkBtn, { backgroundColor: isSaved ? `${primary}40` : 'rgba(0,0,0,0.5)' }]}
              onPress={(e) => { e.stopPropagation?.(); onBookmark(id); }}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? `Remove bookmark: ${title}` : `Bookmark event: ${title}`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="bookmark" size={15} color={isSaved ? primary : '#fff'} />
            </TouchableOpacity>
          </View>
          )}
          </TouchableOpacity>

          {/* Body */}
          <View style={styles.cardBody}>
            {/* User row */}
            <View style={styles.userRow}>
              <TouchableOpacity onPress={() => onOpenViberProfile(event.profiles)}>
                <View style={styles.avatarWrap}>
                  {event.profiles?.avatar_url
                    ? <SmartImage source={thumb.avatar(event.profiles.avatar_url)} style={[styles.avatar, { borderColor: primary }]} />
                    : <View style={[styles.avatar, { borderColor: primary, backgroundColor: AVATAR_COLORS[(event.profiles?.username?.charCodeAt(0) || 0) % AVATAR_COLORS.length], alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>{(event.profiles?.username || 'V')[0].toUpperCase()}</Text>
                    </View>
                  }
                  {checkOnline(event.profiles) && <View style={[styles.onlineDot, { backgroundColor: "#10b981" }]} />}
                </View>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={[styles.username, { color: textColor }]}>
                    {event.profiles?.username || 'Viber'}
                  </Text>
                  {event.profiles?.vibe_score && (
                    <View style={[styles.vibeScoreBadge, { backgroundColor: `${primary}15`, borderColor: `${primary}30` }]}>
                      <Feather name="zap" size={8} color={primary} />
                      <Text style={[styles.vibeScoreText, { color: primary }]}>{event.profiles.vibe_score}</Text>
                    </View>
                  )}
                  {event.profiles?.is_verified && (
                    <View style={[styles.verifiedBadge, { backgroundColor: primary }]}>
                      <Feather name="check" size={8} color="#000" />
                    </View>
                  )}
                </View>
                <Text style={[styles.handle, { color: muted }]}>
                  @{(event.profiles?.username || 'viber').toLowerCase().replace(/\s+/g, '')}
                </Text>
              </View>
              {user && event.profiles?.id && event.profiles.id !== user.id && (
                <TouchableOpacity
                  onPress={() => onFollow(event.profiles.id)}
                  style={[styles.feedFollowBtn, isFollowing && { backgroundColor: 'transparent', borderColor: muted }]}
                >
                  <Text style={[styles.feedFollowText, isFollowing && { color: muted }]}>
                    {isFollowing ? 'Following' : '+ Follow'}
                  </Text>
                </TouchableOpacity>
              )}
              <View style={[styles.priceBadge, {
                backgroundColor: (!event.price || event.price === 'FREE' || event.price === 0) ? 'rgba(16,185,129,0.15)' : `${catColor}22`,
                borderColor: (!event.price || event.price === 'FREE' || event.price === 0) ? "#10b981" : catColor,
              }]}>
                <Text style={[styles.priceText, {
                  color: (!event.price || event.price === 'FREE' || event.price === 0) ? "#10b981" : catColor,
                }]}>
                  {(!event.price || event.price === 0) ? 'FREE' : event.price}
                </Text>
              </View>
            </View>

            {/* Crew signal badge */}
            {crewCount >= 1 && (
              <View style={[styles.crewBadge, { backgroundColor: `${primary}15`, borderColor: `${primary}35` }]}>
                <Feather name="users" size={11} color={primary} />
                <Text style={[styles.crewBadgeText, { color: primary }]}>
                  {crewCount} {crewCount === 1 ? 'person' : 'people'} you follow {crewCount === 1 ? 'is' : 'are'} going
                </Text>
              </View>
            )}

            {/* Two-column row: title+desc LEFT, meta chips RIGHT */}
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={0.8}
                onPress={() => onSelectEvent(event)}
                accessibilityHint="Double-tap to open event details"
              >
                <Text style={[styles.eventTitle, { color: textColor }]}>{title}</Text>
                <Text style={[styles.eventDesc, { color: muted }]} numberOfLines={2}>{event.description}</Text>
              </TouchableOpacity>

              {/* Right column: date / time / venue / countdown chips */}
              <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0, maxWidth: 110 }}>
                {event.event_date ? (
                  <View style={[styles.metaChip, { borderColor: `${primary}22` }]}>
                    <Feather name="calendar" size={10} color={primary} />
                    <Text style={[styles.metaChipText, { color: primary }]}>
                      {new Date(event.event_date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                ) : null}
                {event.event_time ? (
                  <View style={[styles.metaChip, { borderColor: `${muted}30` }]}>
                    <Feather name="clock" size={10} color={muted} />
                    <Text style={[styles.metaChipText, { color: muted }]}>{event.event_time}</Text>
                  </View>
                ) : null}
                {(event.venue_name || event.address) ? (
                  <TouchableOpacity
                    style={[styles.metaChip, { borderColor: `${primary}30` }]}
                    onPress={() => SecurityService.safeOpenURL(`https://maps.google.com/?q=${encodeURIComponent(event.address || event.venue_name)}`)}
                  >
                    <Feather name="map-pin" size={10} color={primary} />
                    <Text style={[styles.metaChipText, { color: primary }]} numberOfLines={1}>
                      {event.venue_name || event.address}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {countdown ? (
                  <View style={[styles.metaChip, { borderColor: `${primary}35`, backgroundColor: `${primary}10` }]}>
                    <Feather name="clock" size={10} color={primary} />
                    <Text style={[styles.metaChipText, { color: primary, fontWeight: '800' }]}>{countdown}</Text>
                  </View>
                ) : null}
                {event._aiRecommended ? (
                  <View style={[styles.metaChip, { borderColor: '#7c3aed50', backgroundColor: '#7c3aed12' }]}>
                    <Text style={{ fontSize: 9 }}>✦</Text>
                    <Text style={[styles.metaChipText, { color: "#a78bfa" }]}>AI Pick</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Item 62: RSVP progress bar with progressbar role */}
            {event.capacity > 0 ? (
              <View style={styles.rsvpWrap}>
                <View style={[styles.rsvpTrack, { backgroundColor: `${catColor}15` }]}>
                  <View
                    style={[
                      styles.rsvpFill,
                      { width: `${goingPct}%`, backgroundColor: catColor },
                      isWeb && { boxShadow: `0 0 10px ${catColor}80` }
                    ]}
                    accessibilityRole="progressbar"
                    accessibilityLabel={`${goingPct}% capacity filled`}
                    {...(isWeb ? { role: 'progressbar', 'aria-valuenow': goingPct, 'aria-valuemin': 0, 'aria-valuemax': 100 } : {})}
                  />
                </View>
                <View style={styles.rsvpLabels}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <AvatarStack count={event.going || 0} primary={primary} />
                    <Text style={[styles.rsvpText, { color: textColor }]}>{event.going || 0} going</Text>
                  </View>
                  {event.capacity - (event.going || 0) > 0 && (
                    <Text style={[styles.rsvpText, { color: muted }]}>
                      {event.capacity - (event.going || 0)} spots left
                    </Text>
                  )}
                </View>
              </View>
            ) : null}

            {/* Ticket */}
            {event.ticket_url ? (
              <TouchableOpacity
                style={[styles.ticketBtn, { borderColor: catColor }]}
                onPress={() => SecurityService.safeOpenURL(event.ticket_url)}
              >
                <Feather name="tag" size={13} color={catColor} />
                <Text style={[styles.ticketText, { color: catColor }]}>Get Tickets / RSVP</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Schedule preview — tap card to see full schedule + polls */}
          {event.schedule?.length > 0 && (
            <TouchableOpacity
              style={[styles.schedulePreview, { backgroundColor: `${primary}0d`, borderTopColor: `${primary}20` }]}
              onPress={() => onSelectEvent(event)}
              activeOpacity={0.8}
            >
              <Feather name="calendar" size={13} color={primary} />
              <Text style={[styles.schedulePreviewText, { color: primary }]}>
                {event.schedule.length} schedule slot{event.schedule.length !== 1 ? 's' : ''}
                {' · '}{event.schedule.slice(0, 2).map(s => s.time).join(', ')}
                {event.schedule.length > 2 ? ' …' : ''}
              </Text>
              <Feather name="chevron-right" size={13} color={primary} />
            </TouchableOpacity>
          )}

          {event.reaction_count > 0 ? (
            <TouchableOpacity
              style={[styles.reactionSummary, { borderTopColor: `${primary}12`, borderBottomColor: `${primary}12` }]}
              onPress={() => onSetReactorsEvent(id)}
              activeOpacity={0.8}
            >
              <Text style={styles.reactionEmojis}>
                {event.reactions_summary
                  || (userReaction ? (REACTION_LIST.find(r => r.key === userReaction)?.emoji || '✨') : '✨')}
              </Text>
              <Text style={[styles.reactionCount, { color: muted }]}>
                {event.reaction_count} {event.reaction_count === 1 ? 'reaction' : 'reactions'}
              </Text>
              <Feather name="chevron-right" size={12} color={muted} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          ) : null}

          {/* Action bar — Item 51: accessible labels on all action buttons */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.actionBarWrapper, { borderTopColor: `${primary}25` }]}>
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onVibe(id)}
                accessibilityRole="button"
                accessibilityLabel={`${isVibed ? 'Remove vibe' : 'Vibe this event'}. ${vibeCounts[id] || 0} vibes`}
              >
                <Feather name="zap" size={19} color={isVibed ? "#ef4444" : muted} />
                <AnimatedCounter value={vibeCounts[id] || 0} style={[styles.actionCount, { color: isVibed ? "#ef4444" : muted }]} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onToggleSection(id, 'react')}
                accessibilityRole="button"
                accessibilityLabel="React to this event"
              >
                {userReaction
                  ? <Text style={{ fontSize: 19 }}>{REACTION_LIST.find(r => r.key === userReaction)?.emoji || '😊'}</Text>
                  : <Feather name="smile" size={19} color={muted} />
                }
                <Text style={[styles.actionLabel, { color: userReaction ? primary : muted }]}>React</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onToggleSection(id, 'echo')}
                accessibilityRole="button"
                accessibilityLabel={`Open comments. ${event.echo_count || 0} comments`}
              >
                <Feather name="message-circle" size={19} color={openSection === 'echo' ? primary : muted} />
                <Text style={[styles.actionCount, { color: openSection === 'echo' ? primary : muted }]}>{event.echo_count || 0}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onToggleSection(id, 'gallery')}
                accessibilityRole="button"
                accessibilityLabel="View event gallery"
              >
                <Feather name="camera" size={19} color={openSection === 'gallery' ? primary : muted} />
                <Text style={[styles.actionLabel, { color: openSection === 'gallery' ? primary : muted }]}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onToggleSection(id, 'pulse')}
                accessibilityRole="button"
                accessibilityLabel="View Pulse Schedule"
              >
                <Feather name="activity" size={19} color={openSection === 'pulse' ? primary : muted} />
                <Text style={[styles.actionLabel, { color: openSection === 'pulse' ? primary : muted }]}>Pulse</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onToggleRoute(event)}
                accessibilityRole="button"
                accessibilityLabel={isRoute ? 'Remove from journey' : 'Pin to your journey'}
              >
                <Feather
                  name={isRoute ? "map-pin" : "plus-circle"}
                  size={19}
                  color={isRoute ? primary : muted}
                />
                <Text style={[styles.actionLabel, { color: isRoute ? primary : muted }]}>Journey</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onToggleSection(id, 'rate')}
                accessibilityRole="button"
                accessibilityLabel="Rate this event"
              >
                <Feather name="star" size={19} color={openSection === 'rate' ? primary : muted} />
                <Text style={[styles.actionLabel, { color: openSection === 'rate' ? primary : muted }]}>Rate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onShare(event)}
                accessibilityRole="button"
                accessibilityLabel={`Share event: ${title}`}
              >
                <Feather name="share-2" size={19} color={muted} />
                <Text style={[styles.actionLabel, { color: muted }]}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={() => {
                safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
                user ? onRsvpEvent(event) : onAuthRequired();
              }}>
                <Feather name="check-circle" size={19} color={muted} />
                <Text style={[styles.actionLabel, { color: muted }]}>RSVP</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={() => onReportTarget({ id, type: 'event' })}>
                <Feather name="flag" size={19} color={muted} />
              </TouchableOpacity>

              {isOwner && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => onEditEvent(event)}>
                  <Feather name="edit-2" size={19} color={primary} />
                </TouchableOpacity>
              )}

              {isOwner && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => onAdminEvent(event)}>
                  <Feather name="bar-chart-2" size={19} color={primary} />
                  <Text style={[styles.actionLabel, { color: primary }]}>Admin</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* Collapsible sections — each in its own SafeSection */}
          {openSection === 'react' && (
            <ReactPicker visible onReact={key => onReact(id, key)} userReaction={userReaction} />
          )}
          {openSection === 'echo' && (
            <EchoSection eventId={id} onAuthRequired={onAuthRequired} />
          )}
          {openSection === 'gallery' && (
            <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
              <EventGallery eventId={id} />
            </View>
          )}
          {openSection === 'rate' && (
            <RatingSection eventId={id} onAuthRequired={onAuthRequired} />
          )}
          {openSection === 'pulse' && (
            <PulseScheduleSection eventId={id} eventCategory={event.category} onAuthRequired={onAuthRequired} />
          )}
          {!isSample && (() => {
            let isEventDay = true;
            if (event.event_date) {
              const evMs = new Date(event.event_date).getTime();
              const diffDays = (Date.now() - evMs) / 86400000;
              isEventDay = diffDays >= -1 && diffDays < 2;
            }
            return isEventDay ? (
              <PresenceBar
                eventId={id}
                eventEndTime={event.end_time}
                eventLat={event.lat}
                eventLon={event.lon}
                onAuthRequired={onAuthRequired}
              />
            ) : null;
          })()}
          {!isSample && (
            <ReturnPathCard
              event={event}
              checkins={checkins || []}
              primary={primary}
              muted={muted}
              textColor={textColor}
              bg={surface}
              onDismiss={() => {}}
              onCheckinsFetch={() => onFetchCheckins(id)}
            />
          )}
        </View>
        </Animated.View>
      </FadeInView>
      {showAd && (
        <AdFlywheel intentTag="attending" onNavigateToServices={onNavigateToServices} />
      )}
    </React.Fragment>
  );
});

// ── Main LandingPage ──────────────────────────────────────────────────────────
export const LandingPage = ({ mode = 'drop', onAuthRequired, targetEvent, onTargetHandled, refreshKey, onNavigateToServices }) => {
  const insets = useSafeAreaInsets();
  const { currentTheme } = useTheme();
  const { user, profile } = useAuth();
  const toast = useToast();
  const { identityMode, modeConfig } = useIdentity();
  const flatListRef = useRef(null);

  const [events, setEvents] = useState([]);
  const [trending, setTrending] = useState([]);
  const [trendingEvents, setTrendingEvents] = useState([]); // full event objects for top trending
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [layoutType, setLayoutType] = useState('list');
  const searchTimer = useRef(null);
  const [routeEvents, setRouteEvents] = useState([]);
  const [routeModalVisible, setRouteModalVisible] = useState(false);
  const [computedRoute, setComputedRoute] = useState([]);
  const [userCoords, setUserCoords] = useState(null);
  
  // Resolve optimal path asynchronously when needed
  useEffect(() => {
    if (routeModalVisible && routeEvents.length > 0) {
      RouteEngine.calculateOptimalPath(routeEvents, userCoords).then(setComputedRoute);
    }
  }, [routeEvents, userCoords, routeModalVisible]);
  const [highlightedId, setHighlightedId] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 10;

  // Modals
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [plannerVisible, setPlannerVisible] = useState(false);
  const [trendingModalVisible, setTrendingModalVisible] = useState(false);
  const [selectedViber, setSelectedViber] = useState(null);
  const [viberModalVisible, setViberModalVisible] = useState(false);
  const [activityVisible, setActivityVisible] = useState(false);
  const [adminEvent, setAdminEvent] = useState(null);

  // Per-card interaction state
  const [myVibes, setMyVibes] = useState(new Set());
  const [vibeCounts, setVibeCounts] = useState({});
  const [reactions, setReactions] = useState({});
  const [savedEvents, setSavedEvents] = useState(new Set());
  const [isVibing, setIsVibing] = useState({});
  const [openSection, setOpenSection] = useState({}); // { [eventId]: 'react'|'echo'|'gallery'|'rate'|'pulse'|null }
  const [reactorsEvent, setReactorsEvent] = useState(null); // eventId to show reactors for
  const [reactorsList, setReactorsList] = useState([]);
  const [reactorsFilter, setReactorsFilter] = useState('all');
  const [reactorsLoading, setReactorsLoading] = useState(false);
  const toggleSection = useCallback((id, section) => {
    startTransition(() => setOpenSection(prev => ({ ...prev, [id]: prev[id] === section ? null : section })));
  }, []);
  const [reactionFlash, setReactionFlash] = useState({});

  // New feature modals
  const [editEvent, setEditEvent] = useState(null);
  const [rsvpEvent, setRsvpEvent] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [crewRsvpMap, setCrewRsvpMap] = useState({}); // eventId → count of followed users going
  const followedIdsRef = useRef([]); // stable ref so fetchPage can use it without re-render
  const pageRef = useRef(0);
  const [followingSet, setFollowingSet] = useState(new Set()); // reactive mirror for follow buttons
  const [dateFilter, setDateFilter] = useState('any');
  const [dateRange, setDateRange] = useState(null);
  const [activeHashtag, setActiveHashtag] = useState(null);
  const [pathMapVisible, setPathMapVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [feedMode, setFeedMode] = useState('all'); // 'all' | 'following'
  const [eventCheckins, setEventCheckins] = useState({}); // eventId → checkins array
  const fetchedCheckinIds = useRef(new Set());

  // ── Mobile UX: gestures, animations, quick actions ─────────────────────────
  const lastTapRef    = useRef({}); // double-tap tracking per card
  const cardScaleRef  = useRef({}); // press-in scale per card
  const heartAnimRef  = useRef({}); // heart burst per card
  const [quickActionTarget, setQuickActionTarget] = useState(null); // long-press quick sheet
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Handle native Android hardware back button inside LandingPage
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const handleBackButton = () => {
      if (selectedEvent) {
        setSelectedEvent(null);
        return true;
      }
      if (routeModalVisible) {
        setRouteModalVisible(false);
        return true;
      }
      if (trendingModalVisible) {
        setTrendingModalVisible(false);
        return true;
      }
      if (viberModalVisible) {
        setViberModalVisible(false);
        return true;
      }
      if (activityVisible) {
        setActivityVisible(false);
        return true;
      }
      if (postModalVisible) {
        setPostModalVisible(false);
        return true;
      }
      if (editEvent) {
        setEditEvent(null);
        return true;
      }
      if (rsvpEvent) {
        setRsvpEvent(null);
        return true;
      }
      if (reportTarget) {
        setReportTarget(null);
        return true;
      }
      if (reactorsEvent) {
        setReactorsEvent(null);
        return true;
      }
      return false; // let it bubble to App.js
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', handleBackButton);
    return () => sub.remove();
  }, [
    selectedEvent, routeModalVisible, trendingModalVisible, viberModalVisible,
    activityVisible, postModalVisible, editEvent, rsvpEvent, reportTarget, reactorsEvent
  ]);

  const primary = currentTheme?.primary || "#00f2ff";
  const bg = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || "#131a1c";

  const loadTrending = useCallback(async () => {
    try {
      const data = await TrendingManager.fetch(8);
      setTrending(data || []);

      // Fetch full event objects so they can appear as interactive cards in the feed
      const ids = (data || []).slice(0, 5).map(s => s.event_id).filter(Boolean);
      if (ids.length) {
        const { data: fullEvents } = await supabase
          .from('events')
          .select('*, profiles!author_id(username, avatar_url, vibe_score, is_verified)')
          .in('id', ids)
          .eq('is_cancelled', false);
        if (fullEvents?.length) {
          const ranked = ids
            .map((id, i) => {
              const ev = fullEvents.find(e => e.id === id);
              return ev ? { ...ev, _isTrending: true, _trendingRank: i + 1 } : null;
            })
            .filter(Boolean);
          setTrendingEvents(ranked);
          return; // done
        }
      }

      // No trending data yet — seed trendingEvents from the top of the main events list
      // so the Recent Gruvs feed always has something to show
      const { data: topEvents } = await supabase
        .from('events')
        .select('*, profiles!author_id(username, avatar_url, vibe_score, is_verified)')
        .eq('is_cancelled', false)
        .order('vibe_count', { ascending: false })
        .limit(5);
      if (topEvents?.length) {
        const ranked = topEvents.map((ev, i) => ({
          ...ev,
          _isTrending: ev.vibe_count > 0,
          _trendingRank: i + 1,
        }));
        setTrendingEvents(ranked);
      }
    } catch { /* trending load is best-effort — feed still works without it */ }
  }, []);

  const loadData = useCallback(async (isRefreshing = false) => {
    if (loadingMore || (!hasMore && !isRefreshing)) {
      if (isRefreshing) setLoading(false);
      return;
    }

    if (isRefreshing) {
      pageRef.current = 0;
      setPage(0);
      setHasMore(true);
      setLoading(events.length === 0);
    } else {
      setLoadingMore(true);
    }

    const currentPage = isRefreshing ? 0 : pageRef.current;
    const fetchOpts = {
      page: currentPage,
      category: selectedCat,
      query: debouncedQuery,
      userInterests: profile?.interests || [],
      mode: feedMode,
      userId: user?.id || null,
      followedIds: followedIdsRef.current,
      dateRange,
    };

    try {
      const { events: newEvents, hasMore: moreAvailable } = await FeedManager.fetchPage(fetchOpts);

      if (isRefreshing) {
        setEvents(newEvents);
      } else {
        setEvents(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          return [...prev, ...newEvents.filter(e => !existingIds.has(e.id))];
        });
      }
      setHasMore(moreAvailable);

      const counts = {};
      newEvents.forEach(e => { counts[e.id] = e.vibe_count || 0; });
      setVibeCounts(prev => ({ ...prev, ...counts }));

      if (user?.id && newEvents.length > 0) {
        const eventIds = newEvents.map(e => e.id);
        const [vibeRes, reactRes] = await Promise.allSettled([
          supabase.from('event_vibes').select('event_id').eq('user_id', user?.id).in('event_id', eventIds),
          supabase.from('event_reactions').select('event_id, reaction_key').eq('user_id', user?.id).in('event_id', eventIds),
        ]);
        if (vibeRes.status === 'fulfilled' && vibeRes.value.data) {
          setMyVibes(prev => {
            const next = new Set(prev);
            vibeRes.value.data.forEach(v => next.add(v.event_id));
            return next;
          });
        }
        if (reactRes.status === 'fulfilled' && reactRes.value.data) {
          setReactions(prev => {
            const next = { ...prev };
            reactRes.value.data.forEach(r => { next[r.event_id] = r.reaction_key; });
            return next;
          });
        }
      }

      if (newEvents.length > 0) {
        pageRef.current = currentPage + 1;
        setPage(pageRef.current);
        FeedManager.prefetchPage({ ...fetchOpts, page: currentPage + 1 });
      }
    } catch (err) {
      toast.show('Failed to load gruvs. Check your connection.', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  // page/hasMore intentionally excluded — use pageRef to read page without recreating on every scroll
  }, [selectedCat, debouncedQuery, feedMode, user?.id, profile?.interests, dateRange]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) loadData(false);
  }, [loadData, loadingMore, hasMore]);

  // Stable feed: trending full-cards first, then regular events (deduped).
  // Computed without emptying the list — prevents the "Kingdom is Quiet" bounce.
  const trendingIds = useMemo(
    () => new Set(trendingEvents.map(e => e.id)),
    [trendingEvents]
  );
  const feedData = useMemo(() => {
    // Category matcher — checks primary category and categories[] array
    const catSet = selectedCat !== 'all' ? CAT_KEY_TO_SUBCATS[selectedCat] || new Set([selectedCat]) : null;
    const matchesCat = (e) => {
      if (!catSet) return true;
      const cat = e.category?.toLowerCase();
      if (cat && catSet.has(cat)) return true;
      if (Array.isArray(e.categories) && e.categories.some(c => catSet.has(c?.toLowerCase()))) return true;
      return false;
    };

    // Date matcher — checks event_date against the active date range
    const matchesDate = (e) => {
      if (!dateRange) return true;
      if (!e.event_date) return true;
      const d = e.event_date.slice(0, 10);
      if (dateRange.from && d < dateRange.from) return false;
      if (dateRange.to   && d > dateRange.to)   return false;
      return true;
    };

    const filter = (e) => matchesCat(e) && matchesDate(e);

    const filteredTrending = trendingEvents.filter(filter);
    const filteredRegular  = events.filter(e => !trendingIds.has(e.id) && filter(e));
    return [...filteredTrending, ...filteredRegular];
  }, [trendingEvents, events, trendingIds, selectedCat, dateRange]);

  // Debounce search — avoids a network hit on every keystroke
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedQuery(searchQuery), 350);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery]);

  // Seed the feed instantly from cache before the network call completes
  useEffect(() => {
    const FEED_CACHE_KEY = `@gruvs_feed_cache_v1`;
    AsyncStorage.getItem(FEED_CACHE_KEY)
      .then(raw => {
        if (!raw) return;
        const { data, ts } = JSON.parse(raw);
        // Only use cache if < 10 minutes old and we haven't loaded network data yet
        if (Date.now() - ts < 600000 && Array.isArray(data) && data.length) {
          setEvents(prev => prev.length === 0 ? data : prev);
          setLoading(false);
        }
      })
      .catch(() => {});
  }, []); // only on mount

  useEffect(() => {
    FeedManager.invalidate('feed:');
    loadData(true);
  }, [selectedCat, debouncedQuery, mode, refreshKey, feedMode, user?.id, dateRange, loadData]);

  // Persist feed to cache after every successful load
  useEffect(() => {
    if (events.length > 0 && !loading) {
      AsyncStorage.setItem('@gruvs_feed_cache_v1',
        JSON.stringify({ data: events.slice(0, 20), ts: Date.now() })
      ).catch(() => {});
    }
  }, [events, loading]);

  // Shake to discover — shake phone to open a random Gruv
  useEffect(() => {
    ShakeDetector.start(() => {
      const pool = feedData.filter(e => e.id);
      if (!pool.length) return;
      const random = pool[Math.floor(Math.random() * pool.length)];
      RichHaptics.heavy();
      setSelectedEvent(random);
    }, 4000);
    return () => ShakeDetector.stop();
  }, [feedData]);

  useEffect(() => {
    loadTrending();
  }, [loadTrending, user?.id, profile?.vibe_score]);

  // Scroll-to + highlight when arriving from Explore

  // Fetch followed IDs once per session (not on every pagination event)
  useEffect(() => {
    if (!user) return;
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .limit(200)
      .then(({ data }) => {
        const ids = (data || []).map(f => f.following_id);
        followedIdsRef.current = ids;
        setFollowingSet(new Set(ids));
      })
      .catch(() => {});
  }, [user?.id]);

  // Crew signal — who among followed users has RSVP'd. Runs only when event IDs change.
  const eventIdsKey = useMemo(() => events.map(e => e.id).join(','), [events]);
  useEffect(() => {
    const followedIds = followedIdsRef.current;
    if (!user || !events.length || !followedIds.length) return;
    const eventIds = events.map(e => e.id);
    supabase
      .from('event_rsvps')
      .select('event_id, user_id')
      .in('event_id', eventIds)
      .in('user_id', followedIds)
      .eq('status', 'going')
      .then(({ data }) => {
        const map = {};
        (data || []).forEach(r => { map[r.event_id] = (map[r.event_id] || 0) + 1; });
        setCrewRsvpMap(prev => ({ ...prev, ...map }));
      })
      .catch(() => {});
  }, [user?.id, eventIdsKey]);

  // Real-time: new events appear instantly + live vibe counts update
  useEffect(() => {
    if (!isSupabaseEnabled) return;
    const channel = supabase
      .channel('landing_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        async (payload) => {
          const newEvt = payload.new;
          if (!newEvt?.id || newEvt.is_cancelled || newEvt.is_deleted) return;
          try {
            const { data } = await supabase
              .from('events')
              .select('*, profiles!author_id(username, avatar_url, vibe_score, social_integrity_score, is_verified)')
              .eq('id', newEvt.id)
              .single();
            if (!data) return;
            setEvents(prev => {
              if (prev.some(e => e.id === data.id)) return prev;
              return [data, ...prev];
            });
            setVibeCounts(prev => ({ ...prev, [data.id]: data.vibe_count || 0 }));
          } catch { }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events' },
        (payload) => {
          const updated = payload.new;
          if (!updated?.id) return;
          // Update vibe count and event data in-place — no refetch needed
          setVibeCounts(prev => ({ ...prev, [updated.id]: updated.vibe_count || 0 }));
          setEvents(prev => prev.map(e =>
            e.id === updated.id ? { ...e, vibe_count: updated.vibe_count, going: updated.going } : e
          ));
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // Fetch checkins for event (for ReturnPathCard)
  const fetchEventCheckins = useCallback(async (eventId) => {
    if (!eventId || fetchedCheckinIds.current.has(eventId)) return; // cached
    fetchedCheckinIds.current.add(eventId);
    try {
      const { data } = await supabase
        .from('live_checkins')
        .select('*, profiles(username, avatar_url, city, address, home_base)')
        .eq('event_id', eventId)
        .order('checked_in_at', { ascending: false });
      setEventCheckins(prev => ({ ...prev, [eventId]: data || [] }));
    } catch {
      fetchedCheckinIds.current.delete(eventId); // allow retry on failure
      setEventCheckins(prev => ({ ...prev, [eventId]: [] }));
    }
  }, []);



  // When a trending spot is tapped — scroll to the matching event in the feed
  const handleTrendingPress = (spot) => {
    const matchTitle = spot.description || spot.title || '';
    const match = events.find(e =>
      e.title?.toLowerCase().includes(matchTitle.toLowerCase().slice(0, 10)) ||
      e.id === spot.event_id
    );
    if (match) {
      const idx = events.indexOf(match);
      setHighlightedId(match.id);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.15 });
      }, 200);
      setTimeout(() => setHighlightedId(null), 3000);
    } else {
      // No match in current feed — filter by category to surface related events
      if (spot.category) setSelectedCat(spot.category);
      toast.show('Showing related events', 'info');
    }
  };

  // ── REMOVED: loadNearby and renderNearby are only used by ExplorePage now ─────

  const handleFollowFromFeed = useCallback(async (profileId) => {
    if (!user || !profileId || profileId === user.id) return;
    const wasFollowing = followingSet.has(profileId);
    setFollowingSet(prev => {
      const n = new Set(prev);
      wasFollowing ? n.delete(profileId) : n.add(profileId);
      return n;
    });
    try {
      const ok = wasFollowing
        ? await resilient(
            [
              () => supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profileId),
              () => supabase.from('follows').update({ unfollowed_at: new Date().toISOString() }).eq('follower_id', user.id).eq('following_id', profileId),
              () => supabase.rpc('unfollow_user', { p_follower_id: user?.id, p_following_id: profileId }),
            ],
            { attemptsPerTier: 2, baseMs: 300, label: `LandingPage.unfollow:${profileId}`, fallbackValue: null }
          )
        : await resilient(
            [
              () => supabase.from('follows').upsert({ follower_id: user?.id, following_id: profileId }, { onConflict: 'follower_id,following_id', ignoreDuplicates: true }),
              () => supabase.from('follows').insert({ follower_id: user?.id, following_id: profileId }),
              () => supabase.rpc('follow_user', { p_follower_id: user?.id, p_following_id: profileId }),
            ],
            { attemptsPerTier: 2, baseMs: 300, label: `LandingPage.follow:${profileId}`, fallbackValue: null }
          );
      if (ok === null) {
        setFollowingSet(prev => {
          const n = new Set(prev);
          wasFollowing ? n.add(profileId) : n.delete(profileId);
          return n;
        });
      }
    } catch {
      setFollowingSet(prev => {
        const n = new Set(prev);
        wasFollowing ? n.add(profileId) : n.delete(profileId);
        return n;
      });
    }
  }, [user, followingSet]);

  const handleVibe = async (eventId) => {
    if (!user) { onAuthRequired(); return; }
    if (isVibing[eventId]) return;

    const isCurrentVibed = myVibes.has(eventId);

    // Block vibing own events before any optimistic update
    const eventAuthorId = events.find(e => e.id === eventId)?.author_id;
    if (!isCurrentVibed && eventAuthorId === user.id) {
      toast.show("You can't vibe your own event", 'info');
      return;
    }

    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

    const rollback = () => {
      setMyVibes(prev => {
        const next = new Set(prev);
        if (isCurrentVibed) next.add(eventId); else next.delete(eventId);
        return next;
      });
      setVibeCounts(prev => ({ ...prev, [eventId]: Math.max(0, (prev[eventId] || 0) + (isCurrentVibed ? 1 : -1)) }));
      setEvents(prev => prev.map(ev =>
        ev.id === eventId ? { ...ev, vibe_count: (ev.vibe_count || 0) + (isCurrentVibed ? 1 : -1) } : ev
      ));
    };

    // Optimistic update
    setMyVibes(prev => {
      const next = new Set(prev);
      if (isCurrentVibed) next.delete(eventId); else next.add(eventId);
      return next;
    });
    setVibeCounts(prev => ({ ...prev, [eventId]: Math.max(0, (prev[eventId] || 0) + (isCurrentVibed ? -1 : 1)) }));
    setEvents(prev => prev.map(ev =>
      ev.id === eventId ? { ...ev, vibe_count: (ev.vibe_count || 0) + (isCurrentVibed ? -1 : 1) } : ev
    ));
    setIsVibing(prev => ({ ...prev, [eventId]: true }));

    try {
      const res = isCurrentVibed
        ? await VibeManager.removeVibe(eventId, user.id)
        : await VibeManager.sendVibe(eventId, user.id, eventAuthorId);

      if (res === 'self') {
        rollback();
        toast.show("You can't vibe your own event", 'info');
      } else if (res === null) {
        rollback();
        toast.show(isCurrentVibed ? 'Failed to remove vibe' : 'Failed to send vibe — try again', 'error');
      }
    } catch (e) {
      rollback();
      toast.show(e?.message || 'Something went wrong', 'error');
    } finally {
      setIsVibing(prev => ({ ...prev, [eventId]: false }));
    }
  };

  const REACTION_COLORS = {
    fire: "#f97316", heart: "#ef4444", hype: "#f59e0b", wow: "#8b5cf6",
    laugh: "#facc15", crown: "#fbbf24", gem: "#06b6d4", rocket: "#3b82f6",
    '100': "#10b981", wave: "#0ea5e9", star: "#eab308", magic: "#a78bfa",
    electric: "#00f2ff", goat: "#84cc16", clap: "#fb923c",
  };

  const handleReact = useCallback(async (eventId, key) => {
    if (!user) { onAuthRequired(); return; }
    const prev_key = reactions[eventId];
    const newKey = prev_key === key ? null : key;
    setReactions(prev => ({ ...prev, [eventId]: newKey }));
    setOpenSection(prev => ({ ...prev, [eventId]: null }));
    const r = REACTION_LIST.find(r => r.key === key);
    if (r) {
      toast.show(`Reacted ${r.emoji}`, 'info');
      const flashColor = REACTION_COLORS[key] || primary;
      setReactionFlash(prev => ({ ...prev, [eventId]: flashColor }));
      setTimeout(() => setReactionFlash(prev => { const n = { ...prev }; delete n[eventId]; return n; }), 600);
    }
    try {
      if (newKey === null) {
        await resilient(
          [
            () => supabase.from('event_reactions').delete().eq('event_id', eventId).eq('user_id', user?.id),
            () => supabase.from('event_reactions').update({ reaction_key: null }).eq('event_id', eventId).eq('user_id', user?.id),
            () => supabase.rpc('remove_event_reaction', { p_event_id: eventId, p_user_id: user?.id }),
          ],
          { attemptsPerTier: 2, baseMs: 200, label: `LandingPage.unreact:${eventId}`, fallbackValue: null }
        );
      } else {
        await resilient(
          [
            () => supabase.from('event_reactions').upsert({ event_id: eventId, user_id: user?.id, reaction_key: newKey }, { onConflict: 'event_id,user_id' }),
            () => supabase.from('event_reactions').insert({ event_id: eventId, user_id: user?.id, reaction_key: newKey }),
            () => supabase.rpc('upsert_event_reaction', { p_event_id: eventId, p_user_id: user?.id, p_key: newKey }),
          ],
          { attemptsPerTier: 2, baseMs: 200, label: `LandingPage.react:${eventId}`, fallbackValue: null }
        );
      }
    } catch { /* best effort */ }
  }, [user, reactions, primary, toast]);

  const handleBookmark = async (eventId) => {
    if (!user) { onAuthRequired(); return; }

    safeHaptic(() => Haptics.selectionAsync());

    const isSaved = savedEvents.has(eventId);

    // Optimistic Update
    setSavedEvents(prev => {
      const next = new Set(prev);
      if (isSaved) next.delete(eventId);
      else next.add(eventId);
      return next;
    });

    try {
      const success = await BookmarkManager.toggle(eventId, user.id, isSaved);
      if (success === isSaved) {
        // If it returns the same state, it failed (BookmarkManager.toggle returns the NEW state)
        // Rollback
        setSavedEvents(prev => {
          const next = new Set(prev);
          if (isSaved) next.add(eventId);
          else next.delete(eventId);
          return next;
        });
        toast.show('Failed to update bookmark', 'error');
      } else {
        toast.show(isSaved ? 'Removed from bookmarks' : 'Added to bookmarks', 'success');
      }
    } catch {
      // Rollback on catch
      setSavedEvents(prev => {
        const next = new Set(prev);
        if (isSaved) next.add(eventId);
        else next.delete(eventId);
        return next;
      });
    }
  };

  const fetchReactors = useCallback(async (eventId) => {
    setReactorsLoading(true);
    try {
      const { data } = await supabase
        .from('event_reactions')
        .select('reaction_key, user_id, profiles:user_id(username, avatar_url)')
        .eq('event_id', eventId)
        .limit(100);
      setReactorsList(data || []);
    } catch { setReactorsList([]); }
    finally { setReactorsLoading(false); }
  }, []);

  const handleShare = (event) => {
    if (!Share?.share) {
      toast.show('Share is not available on this platform', 'info');
      return;
    }
    const dateStr = event.event_date
      ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
      : '';
    const venue = event.venue_name || event.city || '';
    const parts = [`🎉 "${event.title}" on The Gruvs`];
    if (dateStr) parts.push(`📅 ${dateStr}`);
    if (venue) parts.push(`📍 ${venue}`);
    if (event.price === 0 || event.price === 'FREE' || !event.price) parts.push('🆓 FREE entry');
    parts.push(`\nDownload The Gruvs 👉 https://thegruvs.app?event=${event.id}`);
    Share.share({ message: parts.join('\n') })
      .catch(() => { toast.show('Unable to share this Gruv right now', 'error'); });
  };

  const JOURNEY_STORAGE_KEY = useMemo(
    () => user?.id ? `@gruvs_journey_${user.id}_v1` : '@gruvs_journey_guest_v1',
    [user?.id]
  );

  // Load persisted journey events on mount
  useEffect(() => {
    AsyncStorage.getItem(JOURNEY_STORAGE_KEY)
      .then(raw => {
        if (raw) {
          const saved = JSON.parse(raw);
          if (Array.isArray(saved) && saved.length) setRouteEvents(saved);
        }
      })
      .catch(() => {});
  }, [JOURNEY_STORAGE_KEY]);

  const handleToggleRoute = (event) => {
    const isAdded = routeEvents.some(e => e.id === event.id);
    const next = isAdded
      ? routeEvents.filter(e => e.id !== event.id)
      : [...routeEvents, event];
    setRouteEvents(next);
    AsyncStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    if (isAdded) {
      toast.show('Removed from your journey', 'info');
    } else {
      toast.show('Added to your journey 📍', 'success');
      safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    }
  };

  const openViberProfile = useCallback((profile) => {
    if (!profile) return;
    setSelectedViber(profile);
    setViberModalVisible(true);
  }, []);

  // ── HEADER ──────────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <View style={[styles.headerWrap, { borderBottomColor: `${primary}20` }]}>
      {/* Main Row: Logo + Search + Actions */}
      <View style={styles.mainRow}>
        <View style={styles.brandGroup}>
          <BrandLogo size={36} showGlow />
          <View style={styles.wordmarkMini}>
            <Text style={[styles.brandText, { color: primary }]}>GRUVS</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={[styles.brandSub, { color: muted }]}>{mode === 'drop' ? 'DROP' : 'EXPLORE'}</Text>
              {identityMode !== 'public' && (
                <View style={{ backgroundColor: `${modeConfig.color}22`, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 }}>
                  <Text style={{ color: modeConfig.color, fontSize: 7, fontWeight: '900' }}>{modeConfig.label.toUpperCase()}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <GlassView style={styles.compactSearch}>
          <Feather name="search" size={14} color={muted} style={{ marginLeft: 10 }} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search..."
            placeholderTextColor={muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => { if (searchQuery.trim()) saveSearch(searchQuery.trim()); }}
            returnKeyType="search"
          />
        </GlassView>

        <View style={styles.headerActions}>
          {user && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => setPathMapVisible(true)}>
              <Feather name="map" size={18} color={primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.postIconBtn, { backgroundColor: `${primary}15`, borderColor: primary }]}
            onPress={() => user ? setPostModalVisible(true) : onAuthRequired()}
          >
            <Feather name="plus" size={18} color={primary} />
          </TouchableOpacity>
        </View>
      </View>

      <StoriesRow onAuthRequired={onAuthRequired} />

      <CommunityStatsBar />

      {!!user && (
        <FriendActivityFeed
          onPressActivity={async item => {
            if (item.target_type === 'event' && item.target_id) {
              const local = events.find(e => e.id === item.target_id);
              if (local) { setSelectedEvent(local); return; }
              const { data } = await supabase.from('events').select('*').eq('id', item.target_id).maybeSingle();
              if (data) setSelectedEvent(data);
            }
          }}
        />
      )}

      {/* Visitor banner — only if no user */}
      {!user && <VisitorBanner onSignIn={onAuthRequired} primary={primary} muted={muted} />}

      {/* Search history chips */}
      <SearchHistoryBar
        currentQuery={searchQuery}
        onSelect={q => { setSearchQuery(q); setDebouncedQuery(q); }}
        primary={primary}
        muted={muted}
      />

      {/* Date filter strip */}
      <DateFilterStrip
        value={dateFilter}
        onChange={(val, range) => { setDateFilter(val); setDateRange(range); }}
        primary={primary}
        muted={muted}
      />

      {/* Trending hashtags */}
      <HashtagStrip
        activeTag={activeHashtag}
        onTagSelect={tag => { setActiveHashtag(tag); if (tag) setSearchQuery(`#${tag}`); else setSearchQuery(''); }}
        primary={primary}
        muted={muted}
      />

      <TonightAlert
        events={events}
        onPress={ev => {
          const idx = events.findIndex(e => e.id === ev.id);
          if (idx >= 0) flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.1 });
        }}
        primary={primary}
      />

      {/* Vibe Oracle (AI Prediction) — DISABLED */}

      {/* Feed mode toggle — All / Following */}
      {user && (
        <View style={{ flexDirection: 'row', marginHorizontal: 14, marginBottom: 8, gap: 8 }}>
          {[{ key: 'all', label: 'For You', icon: 'home' }, { key: 'following', label: 'Following', icon: 'users' }].map(tab => {
            const active = feedMode === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => {
                  if (feedMode === tab.key) {
                    handleRefresh();
                  } else {
                    setFeedMode(tab.key);
                  }
                  safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
                }}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                  backgroundColor: active ? primary : 'rgba(255,255,255,0.06)',
                  borderWidth: 1, borderColor: active ? primary : 'rgba(255,255,255,0.10)',
                }}
              >
                <Feather name={tab.icon} size={12} color={active ? '#000' : textColor} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: active ? '#000' : textColor }}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Who to follow — suggested people, attractive cards */}
      {user && <SuggestedFollows />}

      {/* Category pills — Item 54: sticky-filter-bar class for glassmorphic sticky on web */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catBar}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingBottom: 8 }}
        {...(Platform.OS === 'web' ? { className: 'sticky-filter-bar' } : {})}
      >
        {CATEGORY_KEYS.map(key => {
          const cfg = CATEGORY_CONFIG[key];
          const isActive = selectedCat === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => startTransition(() => setSelectedCat(isActive ? 'all' : key))}
              style={[styles.pill, {
                backgroundColor: isActive ? cfg.color : 'rgba(255,255,255,0.06)',
                borderColor: isActive ? cfg.color : 'rgba(255,255,255,0.10)',
                borderWidth: 1,
              }]}
            >
              <Text style={{ fontSize: 12 }}>{cfg.icon}</Text>
              <Text style={[styles.pillText, { color: isActive ? '#000' : textColor }]}>{cfg.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // ── TRENDING ROW ──────────────────────────────────────────────────────────────
  const renderTrending = () => {
    if (!trending.length) return null;
    return (
      <View style={styles.trendingSection}>
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Trending Now</Text>
          <TouchableOpacity onPress={() => setTrendingModalVisible(true)} activeOpacity={0.7}>
            <Text style={[styles.seeAll, { color: primary }]}>See all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}
        >
          {trending.slice(0, 6).map((spot, i) => (
            <FadeInView key={spot.event_id || i} delay={i * 60} direction="right">
              <TouchableOpacity
                style={styles.trendCard}
                onPress={() => handleTrendingPress(spot)}
                activeOpacity={0.85}
              >
                <Image
                  source={spot.image ? { uri: spot.image } : { uri: '' }}
                  style={styles.trendImg}
                />
                <View style={[styles.trendOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
                {/* Rank badge */}
                <View style={[styles.trendRank, { backgroundColor: i < 3 ? `${primary}cc` : 'rgba(0,0,0,0.55)' }]}>
                  <Text style={[styles.trendRankText, { color: i < 3 ? '#000' : '#fff' }]}>#{i + 1}</Text>
                </View>
                <View style={styles.trendBody}>
                  <Text style={styles.trendName} numberOfLines={2}>
                    {spot.description || spot.title || 'Trending Gruv'}
                  </Text>
                  <View style={styles.trendMetaRow}>
                    <Feather name="zap" size={10} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.trendMeta}>
                      {spot.rsvp_count || spot.going || 0} Vibing
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </FadeInView>
          ))}
        </ScrollView>
      </View>
    );
  };

  // ── FEED HEADER ───────────────────────────────────────────────────────────────
  const renderFeedHeader = () => (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>
        {mode === 'drop' ? 'Recent Gruvs' : 'All Gruvs'}
      </Text>
      <TouchableOpacity onPress={() => user ? setPostModalVisible(true) : onAuthRequired()}>
        <Text style={[styles.seeAll, { color: primary }]}>Drop a Gruv</Text>
      </TouchableOpacity>
    </View>
  );

  // Stable extraData bundle — FlatList only re-renders items when interaction state actually changes
  const cardExtraData = useMemo(() => ({
    myVibes, vibeCounts, reactions, savedEvents, openSection,
    reactionFlash, routeEvents, crewRsvpMap, followingSet, highlightedId, eventCheckins,
  }), [myVibes, vibeCounts, reactions, savedEvents, openSection, reactionFlash, routeEvents, crewRsvpMap, followingSet, highlightedId, eventCheckins]);

  // ── Mobile gesture helpers ────────────────────────────────────────────────────
  const getCardScale = useCallback((id) => {
    if (!cardScaleRef.current[id]) cardScaleRef.current[id] = new Animated.Value(1);
    return cardScaleRef.current[id];
  }, []);

  const onCardPressIn = useCallback((id) => {
    if (Platform.OS === 'web') return;
    Animated.spring(getCardScale(id), { toValue: 0.977, useNativeDriver: true, tension: 500, friction: 30 }).start();
  }, [getCardScale]);

  const onCardPressOut = useCallback((id) => {
    if (Platform.OS === 'web') return;
    Animated.spring(getCardScale(id), { toValue: 1, useNativeDriver: true, tension: 500, friction: 20 }).start();
  }, [getCardScale]);

  // Double-tap: fires vibe + heart burst; single-tap: opens detail
  const handleImageTap = useCallback((eventItem) => {
    const id = eventItem.id;
    const now = Date.now();
    const last = lastTapRef.current[id] || 0;
    if (now - last < 350 && last !== 0) {
      lastTapRef.current[id] = 0;
      if (!myVibes.has(id)) {
        handleVibe(id);
        // Heart burst animation
        if (!heartAnimRef.current[id]) {
          heartAnimRef.current[id] = { scale: new Animated.Value(0), opacity: new Animated.Value(0) };
        }
        const { scale, opacity } = heartAnimRef.current[id];
        scale.setValue(0); opacity.setValue(1);
        Animated.parallel([
          Animated.spring(scale, { toValue: 1.5, useNativeDriver: true, tension: 200, friction: 8 }),
          Animated.sequence([Animated.delay(450), Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true })]),
        ]).start(() => { scale.setValue(0); });
      }
    } else {
      lastTapRef.current[id] = now;
      setTimeout(() => { if (lastTapRef.current[id] === now) setSelectedEvent(eventItem); }, 210);
    }
  }, [myVibes, handleVibe]);

  const handleImageLongPress = useCallback((eventItem) => {
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    setQuickActionTarget(eventItem);
  }, []);

  // ── EVENT CARD ────────────────────────────────────────────────────────────────
  const renderCard = useCallback(({ item: event, index }) => {
    const id = event.id;
    return (
      <EventCard
        event={event}
        index={index}
        user={user}
        primary={primary}
        surface={surface}
        textColor={textColor}
        muted={muted}
        isVibed={myVibes.has(id)}
        vibeCounts={vibeCounts}
        isSaved={savedEvents.has(id)}
        userReaction={reactions[id]}
        crewCount={crewRsvpMap[id] || 0}
        isHighlighted={highlightedId === id}
        flashColor={reactionFlash[id]}
        isRoute={routeEvents.some(re => re.id === id)}
        isFollowing={followingSet.has(event.profiles?.id)}
        checkins={eventCheckins[id]}
        onAuthRequired={onAuthRequired}
        onNavigateToServices={onNavigateToServices}
        onSelectEvent={setSelectedEvent}
        onEditEvent={setEditEvent}
        onAdminEvent={setAdminEvent}
        onRsvpEvent={setRsvpEvent}
        onReportTarget={setReportTarget}
        onSetReactorsEvent={(eventId) => { setReactorsEvent(eventId); setReactorsFilter('all'); fetchReactors(eventId); }}
        onFetchCheckins={fetchEventCheckins}
        onOpenViberProfile={openViberProfile}
        onFollow={handleFollowFromFeed}
        onImageTap={handleImageTap}
        onImageLongPress={handleImageLongPress}
        onCardPressIn={onCardPressIn}
        onCardPressOut={onCardPressOut}
        scaleValue={getCardScale(id)}
        heartAnim={heartAnimRef.current[id]}
        openSection={openSection[id]}
        onVibe={handleVibe}
        onBookmark={handleBookmark}
        onReact={handleReact}
        onShare={handleShare}
        onToggleRoute={handleToggleRoute}
        onToggleSection={toggleSection}
      />
    );
  }, [myVibes, vibeCounts, reactions, savedEvents, openSection, reactionFlash, routeEvents, crewRsvpMap,
      followingSet, highlightedId, eventCheckins, user, primary, surface, textColor, muted, mode,
      onAuthRequired, onNavigateToServices, handleVibe, handleBookmark, handleReact, handleShare,
      handleToggleRoute, toggleSection, fetchReactors, fetchEventCheckins, openViberProfile,
      handleFollowFromFeed, handleImageTap, handleImageLongPress, onCardPressIn, onCardPressOut,
      getCardScale, heartAnimRef]);

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <LiquidBackground intensity={0.9} />
      <AuraEffect />

      <FlatList
        ref={flatListRef}
        data={feedData}
        key={layoutType}
        numColumns={layoutType === 'grid' ? 2 : 1}
        columnWrapperStyle={layoutType === 'grid' ? { gap: 0 } : undefined}
        keyExtractor={item => String(item.id)}
        extraData={cardExtraData}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setShowScrollTop(y > 600);
        }}
        onScrollToIndexFailed={() => { }}
        removeClippedSubviews={Platform.OS !== 'web'}
        maxToRenderPerBatch={5}
        windowSize={10}
        initialNumToRender={5}
        updateCellsBatchingPeriod={50}
        ListHeaderComponent={
          <>
            {renderHeader()}
            {renderTrending()}
            {mode === 'drop' && (
              <CrewJourneyPanel onEventPress={(ev) => {
                const idx = events.findIndex(e => e.id === ev.id);
                if (idx >= 0) flatListRef.current?.scrollToIndex({ index: idx, animated: true });
              }} />
            )}
            {renderFeedHeader()}
          </>
        }
        renderItem={renderCard}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={primary} colors={[primary]} progressBackgroundColor={surface} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator color={primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          // Only render empty state when data has genuinely settled to zero.
          // During refresh the pull-to-refresh spinner is sufficient — never flash an empty screen.
          loading && events.length === 0 ? (
            <View style={{ paddingTop: 8 }}>
              {[1, 2, 3].map(i => <SkeletonCard key={i} primary={primary} />)}
            </View>
          ) : !loading && feedData.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIconCircle, { backgroundColor: `${primary}12`, borderColor: `${primary}25` }]}>
                <Feather name={feedMode === 'following' ? 'users' : 'compass'} size={48} color={primary} />
                <View style={[styles.emptyIconGlow, { backgroundColor: primary }]} />
              </View>
              <Text style={[styles.emptyTitle, { color: textColor }]}>
                {feedMode === 'following' ? 'Your Crew is Quiet' : 'The Kingdom is Quiet'}
              </Text>
              <Text style={[styles.emptyText, { color: muted }]}>
                {feedMode === 'following'
                  ? "You aren't following anyone who has posted recently, or they haven't dropped any Gruvs yet."
                  : "No gruvs found in this sector. Be the one to start the vibe!"}
              </Text>
              {feedMode === 'following' ? (
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: primary }]}
                  onPress={() => setFeedMode('all')}
                >
                  <Text style={[styles.emptyBtnText, { color: '#000' }]}>Explore All Gruvs</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: `${primary}15`, borderColor: primary }]}
                  onPress={() => user ? setPostModalVisible(true) : onAuthRequired()}
                >
                  <Feather name="plus" size={16} color={primary} />
                  <Text style={[styles.emptyBtnText, { color: primary }]}>Drop the first Gruv</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 140 }}
      />

      {/* Modals — only mount when open so lazy components don't crash on idle load */}
      {postModalVisible && (
        <SafeSection label="Post Event" primary={primary}>
          <PostEventModal
            visible={postModalVisible}
            onClose={() => setPostModalVisible(false)}
            onCreated={(ev) => { FeedManager.invalidate(); setEvents(prev => [ev, ...prev]); }}
            onPostSuccess={() => { FeedManager.invalidate(); loadData(true); }}
          />
        </SafeSection>
      )}

      {plannerVisible && (
        <SafeSection label="Vibe Planner" primary={primary}>
          <PersonalPlannerModal
            visible={plannerVisible}
            onClose={() => setPlannerVisible(false)}
            onNavigateToEvent={(ev) => setSelectedEvent(ev)}
          />
        </SafeSection>
      )}
      {viberModalVisible && (
        <SafeSection label="Profile" primary={primary}>
          <ViberProfileModal
            visible={viberModalVisible}
            user={selectedViber}
            userId={selectedViber?.id}
            onClose={() => setViberModalVisible(false)}
            onNavigateToEvent={(ev) => { setViberModalVisible(false); setSelectedEvent(ev); }}
          />
        </SafeSection>
      )}
      {activityVisible && (
        <SafeSection label="Activity" primary={primary}>
          <ActivityCenterModal
            visible={activityVisible}
            onClose={() => setActivityVisible(false)}
          />
        </SafeSection>
      )}
      {!!adminEvent && (
        <SafeSection label="Admin Panel" primary={primary}>
          <EventAdminPanel
            visible={!!adminEvent}
            onClose={() => setAdminEvent(null)}
            event={adminEvent}
            userId={user?.id}
          />
        </SafeSection>
      )}
      <TrendingModal
        visible={trendingModalVisible}
        onClose={() => setTrendingModalVisible(false)}
        trending={trending}
        primary={primary}
        bg={bg}
        textColor={textColor}
        muted={muted}
        onSelectEvent={handleTrendingPress}
      />
      {!!editEvent && (
        <SafeSection label="Edit Event" primary={primary}>
          <EditEventModal
            visible={!!editEvent}
            onClose={() => setEditEvent(null)}
            event={editEvent}
            onUpdated={(ev) => {
              FeedManager.invalidate(ev.id);
              setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, ...ev } : e));
              if (selectedEvent?.id === ev.id) setSelectedEvent(prev => ({ ...prev, ...ev }));
            }}
            onDeleted={(id) => {
              FeedManager.invalidate(id);
              setEvents(prev => prev.filter(e => e.id !== id));
              setEditEvent(null);
              if (selectedEvent?.id === id) setSelectedEvent(null);
            }}
            onSaved={() => { FeedManager.invalidate(); loadData(true); }}
          />
        </SafeSection>
      )}
      {!!rsvpEvent && (
        <SafeSection label="RSVP" primary={primary}>
          <RSVPConfirmModal
            visible={!!rsvpEvent}
            onClose={() => setRsvpEvent(null)}
            event={rsvpEvent}
            onRsvped={(eventId, status) => {
              setEvents(prev => prev.map(e => e.id === eventId
                ? { ...e, going: (e.going || 0) + (status === 'going' ? 1 : 0) }
                : e
              ));
            }}
          />
        </SafeSection>
      )}
      {!!reportTarget && (
        <SafeSection label="Report" primary={primary}>
          <ReportModal
            visible={!!reportTarget}
            onClose={() => setReportTarget(null)}
            targetId={reportTarget?.id}
            targetType={reportTarget?.type}
          />
        </SafeSection>
      )}
      {/* Reactors modal */}
      <Modal visible={!!reactorsEvent} transparent animationType="slide" onRequestClose={() => setReactorsEvent(null)}>
        <TouchableWithoutFeedback onPress={() => setReactorsEvent(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} />
        </TouchableWithoutFeedback>
        <View style={[styles.reactorsSheet, { backgroundColor: surface }]}>
          <View style={[styles.reactorsHandle, { backgroundColor: `${primary}30` }]} />
          <Text style={[styles.reactorsTitle, { color: textColor }]}>Reactions</Text>
          {(() => {
            // Single source of truth: map every reaction key → emoji from REACTION_LIST.
            const EMOJI_MAP = Object.fromEntries(REACTION_LIST.map(r => [r.key, r.emoji]));
            const emojiFor = (k) => EMOJI_MAP[k] || k;
            // Only the emojis that were ACTUALLY used appear as filter pills.
            const presentEmojis = [...new Set(reactorsList.map(r => emojiFor(r.reaction_key)))];
            const filters = ['all', ...presentEmojis];
            const filtered = reactorsFilter === 'all'
              ? reactorsList
              : reactorsList.filter(r => emojiFor(r.reaction_key) === reactorsFilter);
            return (
              <>
                {presentEmojis.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, marginBottom: 12 }}>
                    {filters.map(f => (
                      <TouchableOpacity
                        key={f}
                        style={[styles.reactorFilterBtn, { backgroundColor: reactorsFilter === f ? primary : `${primary}18`, borderColor: reactorsFilter === f ? primary : `${primary}30` }]}
                        onPress={() => setReactorsFilter(f)}
                      >
                        <Text style={{ fontSize: f === 'all' ? 11 : 18, color: reactorsFilter === f ? '#000' : textColor, fontWeight: '800' }}>
                          {f === 'all' ? 'All' : f}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                {reactorsLoading
                  ? <ActivityIndicator color={primary} style={{ marginTop: 20 }} />
                  : filtered.length === 0
                    ? <Text style={{ color: muted, textAlign: 'center', paddingTop: 24, fontSize: 13 }}>No reactions yet</Text>
                    : (
                      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 32 }}>
                        {filtered.map((r, i) => (
                          <View key={i} style={styles.reactorRow}>
                            {r.profiles?.avatar_url
                              ? <Image source={{ uri: r.profiles.avatar_url }} style={styles.reactorAvatar} />
                              : <View style={[styles.reactorAvatar, { backgroundColor: primary + '30', alignItems: 'center', justifyContent: 'center' }]}>
                                  <Text style={{ color: primary, fontWeight: '900', fontSize: 12 }}>{(r.profiles?.username || '?')[0].toUpperCase()}</Text>
                                </View>
                            }
                            <Text style={[styles.reactorName, { color: textColor }]}>@{r.profiles?.username || 'Viber'}</Text>
                            <Text style={{ fontSize: 22, marginLeft: 'auto' }}>{emojiFor(r.reaction_key)}</Text>
                          </View>
                        ))}
                      </ScrollView>
                    )
                }
              </>
            );
          })()}
        </View>
      </Modal>
      <OfflineBanner />
      {pathMapVisible && (
        <SafeSection label="Path Map" primary={primary}>
          <PathMapScreen visible={pathMapVisible} onClose={() => setPathMapVisible(false)} />
        </SafeSection>
      )}
      {!!selectedEvent && (
        <SafeSection label="Event Detail" primary={primary}>
          <EventDetailScreen
            visible={!!selectedEvent}
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onAuthRequired={onAuthRequired}
          />
        </SafeSection>
      )}

      {/* Royal Journey Builder Floating Action */}
      {routeEvents.length > 0 && (
        <TouchableOpacity
          style={[styles.routeFab, { backgroundColor: primary }]}
          onPress={() => setRouteModalVisible(true)}
          activeOpacity={0.9}
        >
          <View style={styles.routeFabBadge}>
            <Text style={styles.routeFabBadgeText}>{routeEvents.length}</Text>
          </View>
          <Feather name="map" size={24} color="#000" />
        </TouchableOpacity>
      )}

      {routeModalVisible && (
        <SafeSection label="Map View" primary={primary}>
          <EventMapView
            visible={routeModalVisible}
            onClose={() => setRouteModalVisible(false)}
            events={computedRoute}
            userCoords={userCoords}
            isRoute={true}
            onSelectEvent={(ev) => {
              setRouteModalVisible(false);
              setSelectedEvent(ev);
            }}
          />
        </SafeSection>
      )}

      {/* ── Scroll-to-top button ─────────────────────────────────────────── */}
      {showScrollTop && (
        <TouchableOpacity
          style={[styles.scrollTopBtn, { backgroundColor: `${primary}22`, borderColor: `${primary}60`, bottom: (insets.bottom || 0) + 100 }]}
          onPress={() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
          }}
          activeOpacity={0.8}
        >
          <Feather name="chevrons-up" size={18} color={primary} />
        </TouchableOpacity>
      )}

      {/* ── Vibe Plan FAB (bottom left, above nav bar) ────────────────────── */}
      {!!user && (
        <TouchableOpacity
          style={[styles.createFab, { backgroundColor: "#6366f1", bottom: (insets.bottom || 0) + 20, right: undefined, left: 20 }]}
          onPress={() => {
            safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
            setPlannerVisible(true);
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Open your personalised vibe plan"
        >
          <Feather name="calendar" size={22} color="#fff" />
        </TouchableOpacity>
      )}

      {/* ── Create event FAB (bottom right, above nav bar) ───────────────── */}
      <TouchableOpacity
        style={[styles.createFab, { backgroundColor: primary, bottom: (insets.bottom || 0) + 20 }]}
        onPress={() => {
          safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
          user ? setPostModalVisible(true) : onAuthRequired();
        }}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Create a new event"
      >
        <Feather name="plus" size={26} color="#000" />
      </TouchableOpacity>

      {/* ── Long-press quick action sheet ────────────────────────────────── */}
      {!!quickActionTarget && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setQuickActionTarget(null)}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setQuickActionTarget(null)} />
          <View style={[styles.quickSheet, { backgroundColor: surface, borderColor: `${primary}20` }]}>
            <View style={[styles.quickSheetHandle, { backgroundColor: `${primary}40` }]} />
            <Text style={[styles.quickSheetTitle, { color: textColor }]} numberOfLines={1}>
              {quickActionTarget.title}
            </Text>
            {[
              { icon: 'zap', label: myVibes.has(quickActionTarget.id) ? 'Remove Vibe' : 'Vibe it ⚡', action: () => { handleVibe(quickActionTarget.id); setQuickActionTarget(null); } },
              { icon: 'bookmark', label: savedEvents.has(quickActionTarget.id) ? 'Unsave' : 'Save', action: () => { handleBookmark(quickActionTarget.id); setQuickActionTarget(null); } },
              { icon: 'check-circle', label: 'RSVP', action: () => { setRsvpEvent(quickActionTarget); setQuickActionTarget(null); } },
              { icon: 'share-2', label: 'Share', action: () => { handleShare(quickActionTarget); setQuickActionTarget(null); } },
              { icon: 'plus-circle', label: 'Add to Journey', action: () => { handleToggleRoute(quickActionTarget); setQuickActionTarget(null); } },
              { icon: 'info', label: 'View Details', action: () => { setSelectedEvent(quickActionTarget); setQuickActionTarget(null); } },
            ].map(item => (
              <TouchableOpacity key={item.icon} style={[styles.quickSheetRow, { borderBottomColor: `${primary}10` }]} onPress={item.action} activeOpacity={0.7}>
                <Feather name={item.icon} size={20} color={primary} />
                <Text style={[styles.quickSheetLabel, { color: textColor }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.quickSheetRow, { borderBottomColor: 'transparent' }]} onPress={() => setQuickActionTarget(null)}>
              <Text style={[styles.quickSheetLabel, { color: muted, textAlign: 'center', flex: 1 }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  crewBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start', marginBottom: 8 },
  crewBadgeText: { fontSize: 11, fontWeight: '700' },
  root: { flex: 1 },
  createFab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  scrollTopBtn: { position: 'absolute', bottom: 96, right: 20, width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  quickSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, paddingTop: 10, paddingBottom: 34, paddingHorizontal: 4 },
  quickSheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  quickSheetTitle: { fontSize: 14, fontWeight: '800', paddingHorizontal: 20, paddingBottom: 12, opacity: 0.8 },
  quickSheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1 },
  quickSheetLabel: { fontSize: 15, fontWeight: '700' },

  // Header
  headerWrap: { borderBottomWidth: 1, paddingBottom: 2 },
  mainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 10, gap: 10 },
  brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordmarkMini: { justifyContent: 'center' },
  brandText: { fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  brandSub: { fontSize: 7, fontWeight: '800', letterSpacing: 1, marginTop: -1, opacity: 0.6 },

  compactSearch: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 36, borderRadius: 18, borderAlpha: 0.1 },
  searchInput: { flex: 1, fontSize: 12, paddingLeft: 6, height: '100%' },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 8, borderRadius: 20 },
  postIconBtn: { padding: 6, borderRadius: 12, borderWidth: 1 },
  bellDot: { position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: '#000' },

  // Categories
  catBar: { marginTop: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  pillText: { fontSize: 9, fontWeight: '800' },

  // Visitor banner
  visitorBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  visitorText: { flex: 1, fontSize: 12, lineHeight: 17 },

  // Trending banner on full cards
  trendingBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6 },
  trendingBannerText: { color: '#000', fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  // Trending
  trendingSection: { marginBottom: 10, marginTop: 14 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  seeAll: { fontSize: 13, fontWeight: '800' },
  trendCard: { width: TREND_CARD_W, height: TREND_CARD_H, borderRadius: 18, overflow: 'hidden', position: 'relative' },
  trendImg: { width: '100%', height: '100%' },
  trendOverlay: { ...StyleSheet.absoluteFillObject },
  trendRank: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  trendRankText: { fontSize: 10, fontWeight: '900' },
  trendBody: { position: 'absolute', bottom: 10, left: 10, right: 10 },
  trendName: { color: '#fff', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  trendMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trendMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 10 },

  // Card
  eventCard: { flex: 1, marginHorizontal: SCREEN_W < 375 ? 10 : 16, marginBottom: 20, borderRadius: 22, overflow: 'hidden', borderWidth: 1 },
  schedulePreview: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  schedulePreviewText: { fontSize: 12, fontWeight: '700', flex: 1, flexShrink: 1, minWidth: 0 },
  imgSection: { position: 'relative', minHeight: Math.round((SCREEN_W - 32) / 2) },
  catBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  catBadgeText: { fontSize: 9, ...FONT.badge, letterSpacing: 0.8 }, // item 60: 0.8 improves 9px legibility
  bookmarkBtn: { position: 'absolute', bottom: 12, right: 12, padding: 8, borderRadius: 20 },
  cardBody: { padding: 14 },

  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5 },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#000' },
  username: { fontSize: 14, fontWeight: '900', flex: 1, flexShrink: 1, minWidth: 0 },
  vibeScoreBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  vibeScoreText: { fontSize: 8, fontWeight: '900' },
  handle: { fontSize: 10, opacity: 0.6 },
  verifiedBadge: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  priceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  priceText: { fontSize: 11, fontWeight: '900' },
  feedFollowBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: "#00f2ff", backgroundColor: 'rgba(0,242,255,0.1)', marginRight: 6 },
  feedFollowText: { fontSize: 11, fontWeight: '700', color: "#00f2ff" },

  eventTitle: { fontSize: 22, fontWeight: '900', marginBottom: 8, letterSpacing: -0.3 },
  eventDesc: { fontSize: 14, lineHeight: 22, marginBottom: 14, opacity: 0.85 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaText: { fontSize: 11, flexShrink: 1 },

  countdown: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, marginBottom: 10 },
  countdownText: { fontSize: 11, fontWeight: '800' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  metaChipText: { fontSize: 10, fontWeight: '700', flexShrink: 1 },

  rsvpWrap: { marginBottom: 10 },
  rsvpTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 5 },
  rsvpFill: { height: '100%', borderRadius: 3 },
  rsvpLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rsvpText: { fontSize: 10, fontWeight: '700' },

  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: { borderWidth: 1.5 },
  stackMore: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stackMoreText: { fontSize: 7, color: '#fff', fontWeight: '900' },

  ticketBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 14, alignSelf: 'flex-start', marginBottom: 4 },
  ticketText: { fontSize: 12, fontWeight: '800' },

  reactionSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1 },
  reactionEmojis: { fontSize: 14 },
  reactionCount: { fontSize: 11 },

  actionBarWrapper: { borderTopWidth: 1 },
  actionBar: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12, gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 50 },
  actionCount: { fontSize: 13, fontWeight: '800' },
  actionLabel: { fontSize: 10, fontWeight: '700' },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 24, position: 'relative' },
  emptyIconGlow: { position: 'absolute', width: 70, height: 70, borderRadius: 35, opacity: 0.15, shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 20, elevation: 10 },
  emptyTitle: { fontSize: 22, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 30 },
  emptyBtnText: { fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },

  // Royal Journey FAB
  routeFab: { position: 'absolute', bottom: 100, right: 20, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, elevation: 10, zIndex: 100 },
  routeFabBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: "#ef4444", minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000' },
  routeFabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  reactorsSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingBottom: 0, maxHeight: '65%' },
  reactorsHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  reactorsTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: 12, letterSpacing: 0.5 },
  reactorFilterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  reactorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reactorAvatar: { width: 38, height: 38, borderRadius: 19 },
  reactorName: { fontSize: 14, fontWeight: '700' },
});

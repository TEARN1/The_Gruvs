import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Platform, Share, Animated, Modal, Dimensions, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useIdentity } from '../context/IdentityContext';
import { GlassView } from '../components/GlassView';
import { MediaViewer } from '../components/MediaViewer';
import { thumb } from '../utils/storageThumb';
import { feature } from '../constants/launchConfig';
import { track } from '../utils/analytics';
import { MatchVersus, parseMatchCard } from '../components/MatchVersus';
import { WeatherService } from '../services/weatherService';
import { GlitterBurst } from '../components/GlitterBurst';
import { CrowdMeter } from '../components/CrowdMeter';
import { EVENT_TAG_MAP } from '../constants/EventTags';
import { TalentEngine } from '../services/talentEngine';
import { useToast } from '../components/ToastNotification';
import { supabase } from '../services/supabase';
import { RSVPManager, CheckInManager, UserManager, RealtimeManager, CapacityManager, ReminderManager, VibeManager } from '../services/dataFlow';
import { LocationService } from '../services/locationService';
import { SecurityService } from '../services/securityService';
import { affiliateUrl } from '../utils/affiliate';
import { checkEventAge } from '../utils/ageGate';
import { DeviceCalendar, RichHaptics } from '../services/smartphoneFeatures';
import { DirectMessageModal } from '../components/DirectMessageModal';
import { ReportModal } from '../components/ReportModal';
import { GiftingModal } from '../components/GiftingModal';
import { useEventRole } from '../hooks/useEventRole';
import { SafeSection } from '../components/SafeSection';
import { NowPlayingBar } from '../components/NowPlayingBar';
import { EventFollowButton } from '../components/EventFollowButton';
import { SetNowPlayingModal } from '../components/SetNowPlayingModal';
import { VendorMenuSheet } from '../components/VendorMenuSheet';
import { HackathonLeaderboard } from '../components/HackathonLeaderboard';

// ── Static imports — avoids "unknown module" chunk failures on web ──
import { EchoSection }            from '../components/EchoSection';
import { ContinueTheNightCard }   from '../components/ContinueTheNightCard';
import { RatingSection }          from '../components/RatingSection';
import { EventGallery }           from '../components/EventGallery';
import { WaitlistButton }         from '../components/WaitlistButton';
import { EventReactions }         from '../components/EventReactions';
import { LiveEventUpdates }       from '../components/LiveEventUpdates';
import { EventWeather }           from '../components/EventWeather';
import { VIPTierSelector }        from '../components/VIPTierSelector';
import { CarpoolBoard }           from '../components/CarpoolBoard';
import { ResidentLiftsSection }   from '../components/ResidentLiftsSection';
import { ResidentStaysSection }   from '../components/ResidentStaysSection';
import { ResidentTrustBadge }     from '../components/ResidentTrustBadge';
import { EventContextualAds }     from '../components/EventContextualAds';
import { EventScheduleSection }   from '../components/EventScheduleSection';
import { EventChatRoom }          from '../components/EventChatRoom';
import { EventPollSection }       from '../components/EventPollSection';
import { EventPlaylistSection }   from '../components/EventPlaylistSection';
import { EventRoleManager }       from '../components/EventRoleManager';
import { EventMomentsSection }    from '../components/EventMomentsSection';
import { OrganizerDashboard }     from '../components/OrganizerDashboard';
import { LiveEventBanner }        from '../components/LiveEventBanner';
import { EventManagementPanel }   from '../components/EventManagementPanel';
import { PosterInsightsPanel }     from '../components/PosterInsightsPanel';
import { InviteByNameModal }      from '../components/InviteByNameModal';
import { SportManagementPanel }   from '../components/SportManagementPanel';
import { EventGuestsModal }       from '../components/EventGuestsModal';
import { ViberProfileModal }      from '../components/ViberProfileModal';
import { CrossedPathsModal }      from '../components/CrossedPathsModal';
import { PlayerProfileModal }     from '../components/PlayerProfileModal';
import { MatchPredictionCard }    from '../components/MatchPredictionCard';
import { TournamentGovernancePanel } from '../components/TournamentGovernancePanel';
import { useBackClose } from '../hooks/useBackClose';
import { realnessScore } from '../utils/realness';
import { CheckinSync } from '../services/checkinSync';
import { SoundFX } from '../services/soundFX';
import { buildShareText } from '../utils/shareText';
import { EventRecapCard } from '../components/EventRecapCard';
import { money } from '../constants/currencies';
import { setEventSeo, clearEventSeo } from '../utils/seo';
import { getGuestList, downloadCsv } from '../services/guestList';
import { getTurnout } from '../services/turnout';
import { BroadcastModal } from '../components/BroadcastModal';
import { getHostReliability } from '../services/hostStats';
import { lifecycleState } from '../utils/eventLifecycle';
import { DoorCheckInModal } from '../components/DoorCheckInModal';
import { checkinVerdict, movementPlausible } from '../utils/checkinGuard';

const _isSportCat = (cat) => {
  const SPORT_CATS = new Set(['sport','football','soccer','basketball','rugby','cricket','tennis','boxing','mma','athletics','swimming','cycling','golf','volleyball','netball','marathon','triathlon','crossfit','weightlifting','gymnastics','parkour','skateboarding','surfing','esports_sport','sportsday','charity_run','fun_run','judo','karate','taekwondo','bjj','muaythai','kickboxing']);
  return SPORT_CATS.has(cat?.toLowerCase());
};

const SCREEN_W = Dimensions.get('window').width;
const HERO_H = Math.min(300, Math.max(220, SCREEN_W * 0.72));

const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'TBD';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m} ${suffix}`;
};

const formatPrice = (price) => {
  if (!price || price === 0 || price === '0' || price === 'FREE') return 'FREE';
  let parsed = null;
  if (typeof price === 'object') {
    parsed = price;
  } else if (typeof price === 'string' && price.trim().startsWith('{')) {
    try {
      parsed = JSON.parse(price);
    } catch (e) {}
  }
  if (parsed) {
    if (parsed.general !== undefined) {
      const genVal = parseFloat(parsed.general);
      if (!isNaN(genVal)) {
        if (parsed.vip || parsed.vvip) {
          return `${money(genVal, { decimals: true })}+`;
        }
        return money(genVal, { decimals: true });
      }
    }
    return 'TICKETS';
  }
  const parsedFloat = parseFloat(price);
  if (isNaN(parsedFloat)) return price;
  return money(parsedFloat, { decimals: true });
};

export const EventDetailScreen = ({ event, visible, onClose, onAuthRequired }) => {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const { user, profile } = useAuth();
  const { applyLocationPrivacy, applyProfilePrivacy, identityMode } = useIdentity();
  const insets = useSafeAreaInsets();
  const { show: showToast } = useToast();

  const [rsvpStatus, setRsvpStatus] = useState(null);
  const [rsvpFx, setRsvpFx] = useState(0);
  const [checkinFx, setCheckinFx] = useState(0);
  const [secretFx, setSecretFx] = useState(0);
  const prevRevealedRef = useRef(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [goingCount, setGoingCount] = useState(0);
  const [vibeCount, setVibeCount] = useState(event?.vibe_count || 0);
  const [hereCount, setHereCount] = useState(0); // live Touch Downs ("here now")
  const [hasVibed, setHasVibed] = useState(false);
  const [vibeSending, setVibeSending] = useState(false);
  const [capacityStatus, setCapacityStatus] = useState({ hasLimit: false, isSoldOut: false, spotsLeft: null });
  const [hasReminder, setHasReminder] = useState(false);
  const [settingReminder, setSettingReminder] = useState(false);
  const [whoGoingVisible, setWhoGoingVisible] = useState(false);
  const [whoGoing, setWhoGoing] = useState([]);
  const [attendeePreview, setAttendeePreview] = useState([]);
  const [attendeeGroups, setAttendeeGroups] = useState({ mutuals: [], friends: [], neighborhood: [] });
  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [myTicket, setMyTicket] = useState(null);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [crossedVisible, setCrossedVisible] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [weather, setWeather] = useState(null);
  const [calendarAdded, setCalendarAdded] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [roleManagerVisible, setRoleManagerVisible] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'manage' | 'polls' | 'playlist'
  const [momentCaptureOpen, setMomentCaptureOpen] = useState(false);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [guestListBusy, setGuestListBusy] = useState(false);
  // What will ACTUALLY be in the room — RSVPs weighted by each person's real
  // show-up history. The number a host can plan against.
  const [turnout, setTurnout] = useState(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [guests, setGuests] = useState([]);
  const [guestsModalOpen, setGuestsModalOpen] = useState(false);
  // Hype hearts on lineup guests — { [guestId]: { count, mine } }, persisted
  // in event_guest_likes (SQL patch 20). Degrades silently if un-migrated.
  const [guestLikes, setGuestLikes] = useState({});
  const [organizerProfileOpen, setOrganizerProfileOpen] = useState(false);
  const [hostRelLabel, setHostRelLabel] = useState('');
  const [openGuestPlayer, setOpenGuestPlayer] = useState(null);
  const [govOpen, setGovOpen] = useState(false);
  const [giftingOpen, setGiftingOpen] = useState(false);
  const scrollRef = useRef(null);

  const { isOrganiser, isCoHost, canPost, canModerate } = useEventRole(
    event?.id, user?.id, event?.author_id ?? event?.profiles?.id
  );

  const loadGuests = useCallback(() => {
    if (event?.id) TalentEngine.getEventGuests(event.id).then(setGuests).catch(() => {});
  }, [event?.id]);
  useEffect(() => { loadGuests(); }, [loadGuests]);

  // Publish schema.org Event markup + share meta while this event is open, so
  // Google can list it as a rich result and WhatsApp/IG unfurl a real card. The
  // SPA serves one HTML shell for every URL, so without this every event looks
  // identical to a crawler.
  useEffect(() => {
    if (event?.id) setEventSeo(event);
    return () => clearEventSeo();
  }, [event?.id, event?.title, event?.event_date]);

  // Honest turnout. RSVPs lie — everyone taps "going", about half show up. We
  // have the other half of the equation (verified Touch Downs), so we can say
  // what will really be in the room instead of repeating a fiction.
  useEffect(() => {
    let alive = true;
    if (!event?.id) return;
    getTurnout(event).then((t) => { if (alive) setTurnout(t); }).catch(() => {});
    return () => { alive = false; };
  }, [event?.id, goingCount]);

  // Host reliability badge (Truth Score). Read-only; empty until enough history.
  useEffect(() => {
    let alive = true;
    if (!organizer?.id) { setHostRelLabel(''); return; }
    getHostReliability(organizer.id).then((r) => { if (alive) setHostRelLabel(r.label); }).catch(() => {});
    return () => { alive = false; };
  }, [organizer?.id]);

  // Load hype hearts for the lineup once guests are known.
  useEffect(() => {
    if (!guests.length) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('event_guest_likes')
          .select('guest_id, user_id')
          .in('guest_id', guests.map(g => g.id));
        if (!alive || !data) return;
        const state = {};
        for (const g of guests) state[g.id] = { count: 0, mine: false };
        for (const row of data) {
          const s = state[row.guest_id] || (state[row.guest_id] = { count: 0, mine: false });
          s.count += 1;
          if (user && row.user_id === user.id) s.mine = true;
        }
        setGuestLikes(state);
      } catch { /* table not migrated yet */ }
    })();
    return () => { alive = false; };
  }, [guests, user]);

  const toggleGuestLike = useCallback(async (guestId) => {
    if (!user) { onAuthRequired?.(); return; }
    const prev = guestLikes[guestId] || { count: 0, mine: false };
    const liking = !prev.mine;
    setGuestLikes(s => ({ ...s, [guestId]: { count: Math.max(0, prev.count + (liking ? 1 : -1)), mine: liking } }));
    try {
      if (liking) {
        const { error } = await supabase.from('event_guest_likes').upsert(
          { guest_id: guestId, user_id: user.id, event_id: event?.id },
          { onConflict: 'guest_id,user_id', ignoreDuplicates: true },
        );
        if (error) throw error;
      } else {
        const { error } = await supabase.from('event_guest_likes')
          .delete().eq('guest_id', guestId).eq('user_id', user.id);
        if (error) throw error;
      }
    } catch {
      setGuestLikes(s => ({ ...s, [guestId]: prev })); // roll back — don't fake a save
    }
  }, [user, guestLikes, event?.id, onAuthRequired]);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const primary = currentTheme?.primary || "#00f2ff";
  const background = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text || "#ffffff";
  const textMuted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || 'rgba(255,255,255,0.06)';

  const organizer = event?.profiles || {};

  // Safe media resolution — guards against string media_urls (PostgreSQL array literal)
  let media = [];
  try {
    let rawMedia = event?.media;
    if (typeof rawMedia === 'string') { try { rawMedia = JSON.parse(rawMedia); } catch { rawMedia = null; } }
    if (Array.isArray(rawMedia) && rawMedia.length) {
      media = rawMedia;
    } else {
      let urls = event?.media_urls;
      if (typeof urls === 'string') { try { urls = JSON.parse(urls); } catch { urls = null; } }
      if (Array.isArray(urls) && urls.length) {
        media = urls.map(u => ({ type: /\.(mp4|mov|m4v|webm)/i.test(u) ? 'video' : 'image', url: u }));
      } else if (event?.cover_url) {
        media = [{ type: 'image', url: event.cover_url }];
      // TODO(v6): remove image_url/cover_image fallbacks after migration
      } else if (event?.image_url) {
        media = [{ type: 'image', url: event.image_url }];
      } else if (event?.cover_image) {
        media = [{ type: 'image', url: event.cover_image }];
      }
    }
  } catch { media = []; }
  // Serve the hero image downscaled (weserv) — full-res covers were heavy. Videos untouched.
  if (media.length) media = media.map(x => (x && x.type !== 'video' && x.url) ? { ...x, url: thumb.cover(x.url) } : x);
  const matchCard = parseMatchCard(event?.match_card);

  // Funnel: an event detail was opened (discovery → interest step).
  useEffect(() => { if (event?.id) track('event_view', { eventId: event.id, category: event.category }); }, [event?.id]);

  // Countdown clock. Uses the VENUE's timezone (eventInstant) — the old naive
  // `new Date(date+time)` parsed in the viewer's zone, so a Lagos event was hours
  // off in another country. And it derives live/ended from lifecycleState, which
  // BOUNDS the live window — the old `over` stayed true forever, so a year-old
  // event kept showing the "LIVE" banner.
  useEffect(() => {
    const target = eventInstant(event);
    if (target == null) { setCountdown(null); return; }

    const tick = () => {
      const now = Date.now();
      const state = lifecycleState(event, now);      // upcoming | live | recent | ended
      const diff = target - now;
      if (diff > 0) {
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setCountdown({ d, h, m, s, over: false, live: false, ended: false });
      } else {
        setCountdown({
          over: true,                                  // has started (drives recap etc.)
          live: state === 'live',                      // ONLY show LIVE while truly live
          ended: state === 'ended' || state === 'recent',
        });
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [event?.event_date, event?.event_time, event?.timezone, event?.end_date]);

  // Free weather forecast for the event location + date (open-meteo, no key).
  useEffect(() => {
    let cancelled = false;
    setWeather(null);
    if (event?.lat == null || event?.lon == null) return undefined;
    WeatherService.getForecast(event.lat, event.lon, event.event_date)
      .then((w) => { if (!cancelled) setWeather(w); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [event?.id, event?.lat, event?.lon, event?.event_date]);

  // Fire a glitter flourish the moment the secret headliner unlocks.
  useEffect(() => {
    if (!event?.secret_act) return;
    const revealed = goingCount >= (event.secret_reveal_threshold || 25);
    if (revealed && !prevRevealedRef.current) setSecretFx(Date.now());
    prevRevealedRef.current = revealed;
  }, [goingCount, event?.secret_act, event?.secret_reveal_threshold]);

  const fetchUserState = useCallback(async () => {
    if (!user || !event?.id) return;
    const [rsvpRes, followRes, checkinRes] = await Promise.allSettled([
      RSVPManager.getUserStatus(event.id, user.id),
      UserManager.isFollowing(user.id, organizer?.id),
      CheckInManager.hasCheckedIn(event.id, user.id),
    ]);
    if (rsvpRes.status === 'fulfilled' && rsvpRes.value != null) setRsvpStatus(rsvpRes.value);
    if (followRes.status === 'fulfilled' && followRes.value != null) setIsFollowing(followRes.value);
    if (checkinRes.status === 'fulfilled' && checkinRes.value) setCheckedIn(true);
  }, [user, event?.id, organizer?.id]);

  const fetchGoingCount = async () => {
    if (!event?.id) return;
    try {
      const count = await RSVPManager.getGoingCount(event.id);
      setGoingCount(count || 0);
    } catch { }
  };

  // "Here now" = recent Touch Downs (live_checkins) — the verified-presence
  // number. Recent-window match; degrades to 0 if the table isn't reachable.
  const fetchHereCount = async () => {
    if (!event?.id) return;
    try {
      const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
      const { count } = await supabase
        .from('live_checkins')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .gte('checked_in_at', since);
      setHereCount(count || 0);
    } catch { }
  };

  const fetchAttendeePreview = useCallback(async () => {
    if (!event?.id) return;
    try {
      const { data } = await supabase
        .from('event_rsvps')
        .select('profiles:user_id(id, username, display_name, avatar_url, city)')
        .eq('event_id', event.id)
        .eq('status', 'going')
        .limit(100);
      
      const attendees = (data || []).map(r => r.profiles).filter(Boolean);
      setAttendeePreview(attendees.slice(0, 7));

      if (user) {
        const [myProfRes, mutualIds, followingIds] = await Promise.all([
          supabase.from('profiles').select('city').eq('id', user.id).maybeSingle(),
          UserManager.getMutuals(user.id),
          UserManager.getFollowedIds(user.id)
        ]);

        const myCity = myProfRes?.data?.city?.trim().toLowerCase();
        const mutualsList = [];
        const friendsList = [];
        const neighborhoodList = [];

        attendees.forEach(p => {
          if (p.id === user.id) return;
          const isMutual = mutualIds.includes(p.id);
          const isFriend = followingIds.includes(p.id);
          const isNeighbor = myCity && p.city?.trim().toLowerCase() === myCity;

          if (isMutual) {
            mutualsList.push(p);
          } else if (isFriend) {
            friendsList.push(p);
          } else if (isNeighbor) {
            neighborhoodList.push(p);
          }
        });

        setAttendeeGroups({
          mutuals: mutualsList,
          friends: friendsList,
          neighborhood: neighborhoodList
        });
      }
    } catch { }
  }, [event?.id, user]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }).start();
      if (event?.id) {
        fetchUserState();
        fetchGoingCount();
        fetchHereCount();
        fetchAttendeePreview();
        setVibeCount(event?.vibe_count || 0);
        CapacityManager.getStatus(event.id).then(setCapacityStatus);
        if (user) ReminderManager.hasReminder(user.id, event.id).then(setHasReminder);
      }
    } else {
      slideAnim.setValue(0);
    }

    if (!visible || !event?.id) return;

    let unsubVibe = () => {};
    let unsubCheckin = () => {};
    let rsvpChan = null;

    // Real-time: live vibe count — wired to state
    unsubVibe = RealtimeManager.subscribeToVibeCount(event.id, (count) => {
      setVibeCount(count);
    });
    // Real-time: live Touch Down ("here now") count
    unsubCheckin = RealtimeManager.subscribeToAttendees(event.id, () => {
      fetchGoingCount();
      fetchHereCount();
    });
    // Real-time: RSVP changes → refresh going count
    const chanKey = `rsvp_${event.id}`;
    rsvpChan = supabase.channel(chanKey)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps', filter: `event_id=eq.${event.id}` }, () => {
        fetchGoingCount();
      })
      .subscribe();

    return () => {
      unsubVibe();
      unsubCheckin();
      if (rsvpChan) supabase.removeChannel(rsvpChan);
    };
  }, [visible, event?.id, fetchUserState, fetchAttendeePreview]);

  const handleRsvp = useCallback(async (status) => {
    if (!user) { onAuthRequired?.(); return; }
    // Age gate (the only legal hard restriction): no positive RSVP to an 18+
    // Gruv when the user is under the limit.
    if (status === 'going' || status === 'maybe') {
      const ageCheck = checkEventAge(profile, event);
      if (!ageCheck.allowed) { showToast(ageCheck.reason, 'error'); return; }
    }
    if (rsvpLoading) return;
    // Optimistic update
    const prev = rsvpStatus;
    setRsvpStatus(status);
    if (status === 'going' && prev !== 'going') { setGoingCount((c) => c + 1); setRsvpFx(Date.now()); }
    if (prev === 'going' && status !== 'going') setGoingCount((c) => Math.max(0, c - 1));
    setRsvpLoading(true);
    try {
      const ok = await RSVPManager.upsert(event.id, user.id, status);
      if (!ok) throw new Error('RSVP update failed');
      if (status === 'going' || status === 'maybe') track('rsvp', { eventId: event.id, status });
      showToast(
        status === 'going' ? "You're Locked In!" : status === 'maybe' ? "Marked Maybe" : "Removed",
        'success'
      );
    } catch (err) {
      // Rollback on failure
      setRsvpStatus(prev);
      if (status === 'going' && prev !== 'going') setGoingCount((c) => Math.max(0, c - 1));
      if (prev === 'going' && status !== 'going') setGoingCount((c) => c + 1);
      showToast('Could not Vibe. Try again.', 'error');
    } finally {
      setRsvpLoading(false);
    }
  }, [user, profile, rsvpStatus, rsvpLoading, event, onAuthRequired, showToast]);

  const handleAddToCalendar = useCallback(async () => {
    if (!event) return;
    try {
      const result = await DeviceCalendar.addEvent(event);
      if (result.success) {
        setCalendarAdded(true);
        await RichHaptics.success();
        showToast('Gruv added to your calendar! 📅', 'success');
      } else {
        showToast(result.error === 'Permission denied' ? 'Allow calendar access in Settings' : 'Could not add to calendar', 'error');
      }
    } catch { showToast('Could not add to calendar', 'error'); }
  }, [event, showToast]);

  const handleVibe = useCallback(async () => {
    if (!user) { onAuthRequired?.(); return; }
    if (vibeSending) return;
    const wasVibed = hasVibed;
    setHasVibed(!wasVibed);
    setVibeCount(c => wasVibed ? Math.max(0, c - 1) : c + 1);
    setVibeSending(true);
    try {
      const ok = wasVibed
        ? await VibeManager.removeVibe(event.id, user.id)
        : await VibeManager.sendVibe(event.id, user.id);
      if (!ok) throw new Error('vibe failed');
      if (!wasVibed) {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        showToast('⚡ Vibe sent!', 'success');
      }
    } catch {
      setHasVibed(wasVibed);
      setVibeCount(c => wasVibed ? c + 1 : Math.max(0, c - 1));
      showToast('Could not send vibe. Try again.', 'error');
    } finally {
      setVibeSending(false);
    }
  }, [user, event?.id, hasVibed, vibeSending, onAuthRequired, showToast]);

  const handleFollow = async () => {
    if (!user) { onAuthRequired?.(); return; }
    if (followLoading || !organizer?.id) return;
    setIsFollowing(!isFollowing); // optimistic
    setFollowLoading(true);
    try {
      const ok = isFollowing
        ? await UserManager.unfollow(user.id, organizer.id)
        : await UserManager.follow(user.id, organizer.id);
      if (!ok) setIsFollowing(isFollowing); // rollback
    } catch {
      setIsFollowing(isFollowing); // rollback on exception
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      // carry the LIVE Truth-Protocol signals (here now / locked in) into the share
      const shareText = buildShareText({ ...event, here_count: hereCount, going: goingCount });
      await Share.share({ message: shareText, title: event?.title });
    } catch { }
  };

  const handleToggleReminder = async () => {
    if (!user) { onAuthRequired?.(); return; }
    setSettingReminder(true);
    try {
      if (hasReminder) {
        await ReminderManager.cancel(user.id, event.id);
        setHasReminder(false);
        showToast('Reminder cancelled', 'info');
      } else {
        const ok = await ReminderManager.set(user.id, event.id, event.event_date, event.event_time || event.start_time, 60);
        setHasReminder(ok);
        showToast(ok ? 'Reminder set — 1 hour before' : 'Could not set reminder (event may have passed)', ok ? 'success' : 'error');
      }
    } catch {
      showToast('Could not update reminder', 'error');
    } finally {
      setSettingReminder(false);
    }
  };

  const handleWhoGoing = async () => {
    if (!event?.id) return;
    try {
      const { data, error } = await supabase
        .from('event_rsvps')
        .select('profiles(id, username, avatar_url, vibe_score, identity_mode, is_beacon_active)')
        .eq('event_id', event.id)
        .eq('status', 'going')
        .limit(50);
      if (error) throw error;

      const results = (data || [])
        .map(r => r.profiles)
        .filter(Boolean)
        .map(p => applyProfilePrivacy(p, p.id))
        .filter(v => v !== null);

      setWhoGoing(results);
      setWhoGoingVisible(true);
    } catch (err) {
      showToast('Could not load vibers list.', 'error');
    }
  };

  const openMaps = () => {
    if (!event?.venue_name) return;
    const query = encodeURIComponent(event.venue_address || event.venue_name);
    SecurityService.safeOpenURL(`https://maps.google.com/?q=${query}`);
  };

  const openTickets = () => {
    // Route ticket links through any signed affiliate program (commission on
    // sale). No-op until a program + ref code is configured — see utils/affiliate.
    if (event?.ticket_url) SecurityService.safeOpenURL(affiliateUrl(event.ticket_url));
  };

  const handleReport = () => {
    if (!user) { onAuthRequired?.(); return; }
    setReportVisible(true);
  };

  const handleCheckIn = async () => {
    if (!user) { onAuthRequired?.(); return; }
    // Age gate: can't Touch Down at an 18+ Gruv under the limit.
    const ageCheck = checkEventAge(profile, event);
    if (!ageCheck.allowed) { showToast(ageCheck.reason, 'error'); return; }
    if (checkingIn || checkedIn) return;
    setCheckingIn(true);
    try {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch { }
      const coords = await LocationService.requestAndGet();

      // ── Anti-spoof: Touch Down means you're physically here ────────────────
      // Proximity gate (tested checkinGuard, single source of truth). Web GPS via
      // WiFi/IP is inaccurate, so the reject radius is looser there; native is tight.
      const maxMeters = Platform.OS === 'web' ? 10000 : 2000;
      const verdict = checkinVerdict(coords, { lat: Number(event?.lat), lon: Number(event?.lon) }, { maxMeters });
      if (!verdict.allow) {
        showToast(`You need to be at the venue to Touch Down (${(verdict.distanceM / 1000).toFixed(1)}km away)`, 'error');
        return;
      }
      // Teleport check: a check-in here is a spoof if the same user "was" hundreds
      // of km away moments ago — no human covers that gap. Best-effort; never blocks
      // on a lookup failure.
      if (coords) {
        try {
          const { data: recent } = await supabase
            .from('live_checkins')
            .select('lat, lon, checked_in_at')
            .eq('user_id', user.id)
            .order('checked_in_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (recent && !movementPlausible(recent, { lat: coords.lat, lon: coords.lon, at: Date.now() }).plausible) {
            showToast("That's too far, too fast — Touch Down from where you actually are.", 'error');
            return;
          }
        } catch { /* lookup failed — don't block a real check-in */ }
      }

      const privateCoords = coords ? applyLocationPrivacy(coords.lat, coords.lon) : {};
      // Expire the live footprint at the end of the event day (or multi-day end
      // date) so the "here now" count stays honest even for long events, and
      // carry identity mode so ghost check-ins stay anonymous.
      const endBase = event?.end_date || event?.event_date;
      const checkinExpiry = endBase ? new Date(`${endBase}T23:59:59`).toISOString() : null;
      const ok = await CheckInManager.touchDown(event.id, user.id, privateCoords || {}, { expiresAt: checkinExpiry, identityMode });
      if (ok) {
        setCheckedIn(true);
        setCheckinFx(Date.now());
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
        SoundFX.play('touchDown'); // the hero sound — the signature moment
        track('touch_down', { eventId: event.id, category: event.category });
        showToast("Touched Down! Your footprint is lit. 🔥", 'success');
        // Reveal who you keep crossing paths with — but only where there's enough
        // density for it to be magic (parked at launch; see launchConfig).
        if (feature('crossedPaths')) setCrossedVisible(true);
      } else if (await CheckinSync.queueIfOffline(event.id, user.id, privateCoords)) {
        setCheckedIn(true);
        showToast("You're offline — we'll log your Touch Down the moment you're back. 📍", 'info');
      } else {
        showToast('Touch Down failed. Try again.', 'error');
      }
    } catch {
      if (await CheckinSync.queueIfOffline(event.id, user.id, {})) {
        setCheckedIn(true);
        showToast("You're offline — we'll log your Touch Down the moment you're back. 📍", 'info');
      } else {
        showToast('Touch Down failed. Try again.', 'error');
      }
    } finally {
      setCheckingIn(false);
    }
  };

  const capacity = event?.max_attendees || event?.capacity || 0;
  const spotsLeft = capacityStatus.spotsLeft ?? Math.max(0, capacity - goingCount);
  const isSoldOut = capacityStatus.isSoldOut || (capacity > 0 && goingCount >= capacity);
  const capacityPct = capacity > 0 ? Math.min(1, goingCount / capacity) : 0;
  const realness = realnessScore({ vibes: vibeCount, going: goingCount, here: hereCount });

  const RSVP_OPTIONS = [
    { key: 'going', label: 'Locked In', icon: 'check-circle' },
    { key: 'maybe', label: 'Maybe', icon: 'help-circle' },
    { key: 'not_going', label: 'Not Going', icon: 'x-circle' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose} statusBarTranslucent>
      <View
        style={[styles.root, { backgroundColor: background }]}
        accessibilityViewIsModal
        accessibilityLabel={event?.title ? `Event details: ${event.title}` : 'Event details'}
        {...(Platform.OS === 'web' ? { 'aria-modal': true } : {})}
      >

        <View style={styles.hero}>
          {matchCard ? (
            <MatchVersus match={matchCard} height={HERO_H} isWeb={Platform.OS === 'web'} />
          ) : (
            <MediaViewer media={media} containerWidth={undefined} aspectRatio={event.poster_mode ? 3 / 4 : 16 / 9} fitToImage={!!event.poster_mode} resizeMode={event.poster_mode ? 'contain' : 'cover'} eventId={event?.id} onAuthRequired={onAuthRequired} />
          )}
          {!event.poster_mode && <View style={styles.heroScrim} pointerEvents="none" />}

          {event?.category && (
            <View style={[styles.categoryBadge, { backgroundColor: primary + 'cc' }]}>
              <Text style={styles.categoryText}>{event.category.toUpperCase()}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.heroBtn, styles.closeBtn, { top: insets.top + 8 }]}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close event details"
          >
            <Feather name="x" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.heroBtn, styles.shareBtn, { top: insets.top + 8 }]} onPress={handleShare} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="share-2" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.body}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.bodyContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                try { await Promise.all([fetchUserState(), fetchGoingCount(), fetchHereCount()]); } catch { } finally { setRefreshing(false); }
              }}
              tintColor={primary}
              colors={[primary]}
            />
          }
        >

          {event?.id && (
            <SafeSection label="Moments" primary={primary}>
              <EventMomentsSection
                event={event}
                primary={primary}
                textColor={textColor}
                surface={surface}
                triggerCapture={momentCaptureOpen}
                onCaptureHandled={() => setMomentCaptureOpen(false)}
              />
            </SafeSection>
          )}

          <View style={styles.organizerRow}>
            <TouchableOpacity
              style={styles.avatarWrap}
              onPress={() => organizer?.id && setOrganizerProfileOpen(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`View ${organizer.username || 'organizer'}'s profile`}
            >
              {organizer.avatar_url
                ? <Image source={{ uri: thumb.avatarLg(organizer.avatar_url) }} style={styles.avatar} />
                : <View style={[styles.avatar, { backgroundColor: ["#0891b2", "#7c3aed", "#059669", "#dc2626"][(organizer.username?.charCodeAt(0) || 0) % 4], alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{(organizer.username || 'V')[0].toUpperCase()}</Text>
                </View>
              }
              <View style={[styles.onlineDot, { backgroundColor: primary }]} />
              {organizer.is_verified && (
                <View style={[styles.verifiedBadge, { backgroundColor: primary }]}>
                  <Feather name="check" size={8} color="#000" />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.organizerMeta}>
              <TouchableOpacity onPress={() => organizer?.id && setOrganizerProfileOpen(true)} activeOpacity={0.7}>
                <Text style={[styles.organizerName, { color: textColor }]}>
                  {organizer.username || 'Unknown Organizer'}
                </Text>
              </TouchableOpacity>
              {/* Truth Score: does this host actually deliver? Earned from their
                  past events (started on time? crowd showed?). Hidden until there's
                  enough history — a new host is never shown as unreliable. */}
              {!!hostRelLabel && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Feather name="shield" size={11} color={primary} />
                  <Text style={{ color: primary, fontSize: 11, fontWeight: '700' }}>{hostRelLabel}</Text>
                </View>
              )}
              {organizer.vibe_score != null && (
                <View style={[styles.vibeBadge, { borderColor: primary + '80' }]}>
                  <Feather name="zap" size={10} color={primary} />
                  <Text style={[styles.vibeScore, { color: primary }]}>{organizer.vibe_score}</Text>
                </View>
              )}
              {/* Trust provenance from the sister app (no-op until the trust
                  bridge is live — tier is simply undefined before then). */}
              <ResidentTrustBadge tier={organizer.resident_trust_tier} style={{ marginTop: 3 }} />
            </View>

            <TouchableOpacity
              style={[styles.followBtn, { borderColor: primary, backgroundColor: isFollowing ? primary : 'transparent' }]}
              onPress={handleFollow}
              disabled={followLoading}
              accessibilityRole="button"
              accessibilityLabel={isFollowing ? `Unfollow ${organizer.username}` : `Follow ${organizer.username}`}
            >
              <Text style={[styles.followBtnText, { color: isFollowing ? '#000' : primary }]}>
                {isFollowing ? 'Locked In' : 'Lock In'}
              </Text>
            </TouchableOpacity>

            {user && organizer?.id && user.id !== organizer.id && (
              <TouchableOpacity
                style={[styles.messageOrganizerBtn, { borderColor: `${primary}50`, backgroundColor: `${primary}12` }]}
                onPress={() => setDmOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Message ${organizer.username || 'organizer'}`}
              >
                <Feather name="message-circle" size={16} color={primary} />
              </TouchableOpacity>
            )}

            {user && organizer?.id && user.id !== organizer.id && (
              <TouchableOpacity
                style={[styles.messageOrganizerBtn, { borderColor: `${primary}50`, backgroundColor: `${primary}12`, marginLeft: 8 }]}
                onPress={() => setGiftingOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Gift ${organizer.username || 'organizer'}`}
              >
                <Feather name="gift" size={16} color={primary} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.title, { color: textColor }]}>{event?.title || 'Untitled Gruv'}</Text>

          {!!event?.description && event.description !== 'See poster for details.' && (
            <Text style={[styles.description, { color: textMuted }]}>{event.description}</Text>
          )}

          <View style={styles.metaRow}>
            <MetaChip icon="calendar" label={event?.end_date && event.end_date !== event.event_date ? `${formatDate(event?.event_date)} → ${formatDate(event.end_date)}` : formatDate(event?.event_date)} color={primary} />
            {!!(event?.event_time || event?.date_time) && (
              <MetaChip
                icon="clock"
                label={
                  (event?.event_time ? formatTime(event.event_time) : new Date(event.date_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})) +
                  (event?.end_time ? ` – ${formatTime(event.end_time)}` : '')
                }
                color={primary}
              />
            )}
            {!!event?.venue_name && (
              <TouchableOpacity onPress={openMaps}>
                <MetaChip icon="map-pin" label={event.venue_name} color={primary} pressable />
              </TouchableOpacity>
            )}
            {weather && (
              <MetaChip icon={weather.icon} label={`${weather.tempMax}° · ${weather.label}`} color="#38bdf8" />
            )}
            {event?.power_backup && (() => {
              const PMAP = { generator: ['Generator', 'zap'], solar: ['Solar', 'sun'], ups: ['UPS / Inverter', 'battery-charging'], grid: ['Grid only', 'zap-off'] };
              const [plabel, picon] = PMAP[event.power_backup] || ['Power', 'zap'];
              return <MetaChip icon={picon} label={plabel} color={event.power_backup !== 'grid' ? '#10b981' : '#f59e0b'} />;
            })()}
            <MetaChip icon="tag" label={formatPrice(event?.price)} color={primary} />
            {!!event?.age_restriction && (
              <MetaChip
                icon="shield"
                label={event.age_max && event.age_max !== 99 ? `${event.age_restriction}–${event.age_max}` : `${event.age_restriction}+`}
                color="#f59e0b"
              />
            )}
            {(event?.tags || []).map((key) => {
              const t = EVENT_TAG_MAP[key];
              if (!t) return null;
              return (
                <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: `${t.color}55`, backgroundColor: `${t.color}1a` }}>
                  <Text style={{ fontSize: 11 }}>{t.emoji}</Text>
                  <Text style={{ color: t.color, fontSize: 11, fontWeight: '700' }}>{t.label}</Text>
                </View>
              );
            })}
            {!!event?.contact_phone && (
              <TouchableOpacity onPress={() => SecurityService.safeOpenURL(`tel:${event.contact_phone}`)}>
                <MetaChip icon="phone" label={event.contact_phone} color={primary} pressable />
              </TouchableOpacity>
            )}
            {!!event?.contact_email && (
              <TouchableOpacity onPress={() => SecurityService.safeOpenURL(`mailto:${event.contact_email}`)}>
                <MetaChip icon="mail" label={event.contact_email} color={primary} pressable />
              </TouchableOpacity>
            )}
          </View>

          {/* Ticket Tiers Section */}
          {(() => {
            if (!event?.price) return null;
            let parsed = null;
            if (typeof event.price === 'object') {
              parsed = event.price;
            } else if (typeof event.price === 'string' && event.price.trim().startsWith('{')) {
              try {
                parsed = JSON.parse(event.price);
              } catch (e) {}
            }
            if (!parsed) return null;
            const hasTiers = parsed.general || parsed.vip || parsed.vvip || parsed.other;
            if (!hasTiers) return null;
            return (
                  <View style={[styles.ticketSection, { backgroundColor: `${primary}06`, borderColor: `${primary}18` }]}>
                    <Text style={[styles.ticketSectionTitle, { color: primary }]}>🎟️ TICKET OPTIONS</Text>
                    <View style={styles.ticketGrid}>
                      {parsed.general ? (
                        <View style={styles.ticketTier}>
                          <Text style={[styles.ticketLabel, { color: textMuted }]}>General / Entry</Text>
                          <Text style={[styles.ticketValue, { color: textColor }]}>{money(parseFloat(parsed.general), { decimals: true })}</Text>
                        </View>
                      ) : null}
                      {parsed.vip ? (
                        <View style={styles.ticketTier}>
                          <Text style={[styles.ticketLabel, { color: "#f59e0b" }]}>👑 VIP</Text>
                          <Text style={[styles.ticketValue, { color: "#f59e0b" }]}>{money(parseFloat(parsed.vip), { decimals: true })}</Text>
                        </View>
                      ) : null}
                      {parsed.vvip ? (
                        <View style={styles.ticketTier}>
                          <Text style={[styles.ticketLabel, { color: "#d946ef" }]}>💎 VVIP</Text>
                          <Text style={[styles.ticketValue, { color: "#d946ef" }]}>{money(parseFloat(parsed.vvip), { decimals: true })}</Text>
                        </View>
                      ) : null}
                    </View>
                    {parsed.other ? (
                      <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: `${primary}12`, paddingTop: 8 }}>
                        <Text style={[styles.ticketLabel, { color: textMuted }]}>Other Packages</Text>
                        <Text style={[styles.ticketValue, { color: textColor, fontSize: 13, fontWeight: '700' }]}>{parsed.other}</Text>
                      </View>
                    ) : null}
                  </View>
                );
          })()}

          {/* Weather forecast */}
          {event && (
            <SafeSection label="Weather" primary={primary}>
              <EventWeather
                event={event}
                primary={primary}
                textColor={textColor}
                muted={textMuted}
                surface={surface}
              />
            </SafeSection>
          )}

          {/* Countdown Timer */}
          {countdown && !countdown.over && (
            <View style={[styles.countdownBar, { backgroundColor: `${primary}10`, borderColor: `${primary}25` }]}>
              <Feather name="clock" size={13} color={primary} />
              {countdown.d > 0 ? (
                <>
                  <CountdownUnit value={countdown.d} label="D" primary={primary} textColor={textColor} />
                  <Text style={[styles.countdownSep, { color: primary }]}>:</Text>
                  <CountdownUnit value={countdown.h} label="H" primary={primary} textColor={textColor} />
                  <Text style={[styles.countdownSep, { color: primary }]}>:</Text>
                  <CountdownUnit value={countdown.m} label="M" primary={primary} textColor={textColor} />
                </>
              ) : (
                <>
                  <CountdownUnit value={countdown.h} label="H" primary={primary} textColor={textColor} />
                  <Text style={[styles.countdownSep, { color: primary }]}>:</Text>
                  <CountdownUnit value={countdown.m} label="M" primary={primary} textColor={textColor} />
                  <Text style={[styles.countdownSep, { color: primary }]}>:</Text>
                  <CountdownUnit value={countdown.s} label="S" primary={primary} textColor={textColor} />
                </>
              )}
              <Text style={[styles.countdownLabel, { color: textMuted }]}>until the Gruv</Text>
            </View>
          )}
          {/* Now Playing bar — music, festival, rave, party events */}
          {countdown?.over && !_isSportCat(event?.category) && (
            <NowPlayingBar
              eventId={event?.id}
              onPress={isOrganiser ? () => setNowPlayingOpen(true) : undefined}
            />
          )}

          {/* Host: Set Now Playing modal */}
          {isOrganiser && event?.id && (
            <SetNowPlayingModal
              eventId={event.id}
              visible={nowPlayingOpen}
              onClose={() => setNowPlayingOpen(false)}
            />
          )}

          {/* Host only: the door list. RSVP next to VERIFIED attendance — the one
              thing a spreadsheet can't give them, and the first thing they ask for. */}
          {isOrganiser && event?.id && (
            <TouchableOpacity
              onPress={async () => {
                if (guestListBusy) return;
                setGuestListBusy(true);
                try {
                  const rows = await getGuestList(event.id);
                  if (!rows.length) { showToast('No guests yet — no RSVPs or Touch Downs.'); return; }
                  const ok = downloadCsv(rows, event.title);
                  showToast(ok
                    ? `Guest list downloaded — ${rows.length} guest${rows.length === 1 ? '' : 's'}.`
                    : 'Download is only available on the web app.');
                } finally {
                  setGuestListBusy(false);
                }
              }}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginHorizontal: 16, marginTop: 12, paddingVertical: 12, borderRadius: 12,
                borderWidth: 1, borderColor: `${primary}40`, backgroundColor: `${primary}10`,
              }}
            >
              <Feather name={guestListBusy ? 'loader' : 'download'} size={15} color={primary} />
              <Text style={{ color: primary, fontWeight: '800', fontSize: 13 }}>
                {guestListBusy ? 'Building guest list…' : 'Download guest list (CSV)'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Host only: reach everyone who committed. A last-minute change with
              no way to tell them strands people at a locked door — that single
              experience costs more trust than any missing feature. */}
          {isOrganiser && event?.id && (
            <TouchableOpacity
              onPress={() => setBroadcastOpen(true)}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginHorizontal: 16, marginTop: 10, paddingVertical: 12, borderRadius: 12,
                borderWidth: 1, borderColor: `${primary}40`, backgroundColor: `${primary}10`,
              }}
            >
              <Feather name="radio" size={15} color={primary} />
              <Text style={{ color: primary, fontWeight: '800', fontSize: 13 }}>Send an update to everyone coming</Text>
            </TouchableOpacity>
          )}

          {/* Host only: work the door. Validates the CSPRNG ticket, admits once,
              rejects a re-used code — the usable end of the ticket system. */}
          {isOrganiser && event?.id && (
            <TouchableOpacity
              onPress={() => setDoorOpen(true)}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginHorizontal: 16, marginTop: 10, paddingVertical: 12, borderRadius: 12,
                borderWidth: 1, borderColor: `${primary}40`, backgroundColor: `${primary}10`,
              }}
            >
              <Feather name="check-square" size={15} color={primary} />
              <Text style={{ color: primary, fontWeight: '800', fontSize: 13 }}>Door check-in</Text>
            </TouchableOpacity>
          )}

          {isOrganiser && event?.id && (
            <DoorCheckInModal visible={doorOpen} onClose={() => setDoorOpen(false)} event={event} />
          )}

          {isOrganiser && event?.id && (
            <BroadcastModal
              visible={broadcastOpen}
              onClose={() => setBroadcastOpen(false)}
              event={event}
              hostId={user?.id}
              onSent={(n) => showToast(n ? `Update sent to ${n} ${n === 1 ? 'person' : 'people'}.` : 'Nobody has RSVPd yet.')}
            />
          )}

          {countdown?.live && (
            <SafeSection label="Live Banner" primary={primary}>
              <LiveEventBanner
                event={event}
                primary={primary}
                textColor={textColor}
                surface={surface}
                capacity={event?.max_attendees || event?.capacity || 0}
                onAddMoment={user ? () => setMomentCaptureOpen(true) : null}
              />
            </SafeSection>
          )}

          {/* Post-event recap — hype vs reality, the number organizers can't spin */}
          {countdown?.over && (
            <SafeSection label="Recap" primary={primary}>
              <EventRecapCard eventId={event?.id} rsvpd={goingCount} vibes={vibeCount} />
            </SafeSection>
          )}

          {/* Attendee preview strip */}
          {attendeePreview.length > 0 && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, paddingHorizontal: 2 }}
              onPress={handleWhoGoing}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row' }}>
                {attendeePreview.slice(0, 6).map((p, i) => (
                  <View key={p.id || i} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i, borderRadius: 18, borderWidth: 2, borderColor: background }}>
                    {p.avatar_url
                      ? <Image source={{ uri: thumb.avatar(p.avatar_url) }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                      : <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: ["#0891b2","#7c3aed","#059669","#d97706","#db2777","#dc2626"][i % 6], alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>{(p.username || '?')[0].toUpperCase()}</Text>
                        </View>
                    }
                  </View>
                ))}
              </View>
              <Text style={{ color: textMuted, fontSize: 12, fontWeight: '700', flex: 1 }}>
                {attendeePreview[0]?.username && `@${attendeePreview[0].username}`}
                {attendeePreview.length > 1 && ` and ${goingCount - 1} others locked in`}
              </Text>
              <Feather name="chevron-right" size={14} color={primary} />
            </TouchableOpacity>
          )}

          {/* Vibe count + Who's Going */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <TouchableOpacity
              style={[styles.vibePill, { backgroundColor: hasVibed ? `${primary}30` : `${primary}15`, borderColor: hasVibed ? primary : `${primary}30` }]}
              onPress={handleVibe}
              disabled={vibeSending}
              activeOpacity={0.7}
            >
              <Feather name="zap" size={13} color={primary} />
              <Text style={[styles.vibeCountText, { color: primary }]}>{vibeCount} Vibe{vibeCount !== 1 ? 's' : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.vibePill, { backgroundColor: `${primary}08`, borderColor: `${primary}20` }]}
              onPress={handleWhoGoing}
            >
              <Feather name="users" size={13} color={primary} />
              <Text style={[styles.vibeCountText, { color: primary }]}>{goingCount} Locked In</Text>
            </TouchableOpacity>
            {hereCount > 0 && (
              <View style={[styles.vibePill, { backgroundColor: '#10b98118', borderColor: '#10b98140' }]}>
                <Feather name="map-pin" size={13} color="#10b981" />
                <Text style={[styles.vibeCountText, { color: '#10b981' }]}>{hereCount} Here</Text>
              </View>
            )}
            {isSoldOut && (
              <View style={[styles.vibePill, { backgroundColor: '#ef444420', borderColor: '#ef444440' }]}>
                <Feather name="alert-circle" size={13} color="#ef4444" />
                <Text style={{ color: "#ef4444", fontSize: 11, fontWeight: '800' }}>SOLD OUT</Text>
              </View>
            )}
          </View>
          {(realness.tier === 'real' || realness.tier === 'hyped') && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Feather name={realness.tier === 'real' ? 'check-circle' : 'alert-triangle'} size={12} color={realness.tier === 'real' ? '#10b981' : '#f59e0b'} />
              <Text style={{ color: realness.tier === 'real' ? '#10b981' : '#f59e0b', fontSize: 11, fontWeight: '800' }}>{realness.label}</Text>
            </View>
          )}

          {capacity > 0 && !isSoldOut && (
            <GlassView style={[styles.capacityCard, { backgroundColor: surface }]}>
              <View style={styles.capacityHeader}>
                <Text style={[styles.capacityLabel, { color: textColor }]}>
                  {goingCount} <Text style={{ color: textMuted }}>/ {capacity} Locked In</Text>
                </Text>
                <Text style={[styles.spotsLeft, { color: spotsLeft < 10 ? "#ff6b6b" : primary }]}>
                  {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <View style={[styles.progressFill, { width: `${capacityPct * 100}%`, backgroundColor: capacityPct > 0.8 ? "#ef4444" : primary }]} />
              </View>
              {/* The honest number. Everyone taps "going"; about half actually
                  show. We have the Touch Down history, so we can say what will
                  really be in the room instead of repeating the RSVP fiction. */}
              {turnout && turnout.confidence !== 'low' && turnout.going > 0 && (
                <Text style={{ color: textMuted, fontSize: 11.5, marginTop: 8, fontWeight: '600' }}>
                  ~{turnout.expected} usually show
                  {turnout.capacity?.label ? ` · ${turnout.capacity.label}` : ''}
                </Text>
              )}
            </GlassView>
          )}

          <GlassView style={[styles.rsvpCard, { backgroundColor: surface }]}>
            <Text style={[styles.sectionLabel, { color: textMuted }]}>VIBE</Text>
            <View style={styles.rsvpRow}>
              {RSVP_OPTIONS.map((opt) => {
                const active = rsvpStatus === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.rsvpBtn,
                      { borderColor: active ? primary : 'rgba(255,255,255,0.15)', backgroundColor: active ? primary + '22' : 'transparent' },
                    ]}
                    onPress={() => handleRsvp(opt.key)}
                    disabled={rsvpLoading}
                  >
                    <Feather name={opt.icon} size={16} color={active ? primary : textMuted} />
                    <Text style={[styles.rsvpBtnText, { color: active ? primary : textMuted }]}>{opt.label}</Text>
                    {opt.key === 'going' && <GlitterBurst trigger={rsvpFx} size={150} colors={[primary, '#fde047', '#ffffff', '#34d399', '#f0abfc']} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </GlassView>

          {event?.id && event?.event_date === new Date().toISOString().slice(0, 10) && (
            <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
              <CrowdMeter eventId={event.id} primary={primary} textColor={textColor} muted={textMuted} surface={surface} onAuthRequired={onAuthRequired} />
            </View>
          )}

          {!!event?.secret_act && (() => {
            const threshold = event.secret_reveal_threshold || 25;
            const revealed = goingCount >= threshold;
            const toGo = Math.max(0, threshold - goingCount);
            const pct = Math.min(100, Math.round((goingCount / threshold) * 100));
            return (
              <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
                <View style={{ borderWidth: 1, borderColor: revealed ? '#fbbf24' : `${primary}30`, borderRadius: 16, padding: 14, backgroundColor: surface, position: 'relative', overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Feather name={revealed ? 'star' : 'lock'} size={14} color={revealed ? '#fbbf24' : primary} />
                    <Text style={{ color: textColor, fontWeight: '900', fontSize: 13 }}>{revealed ? 'Headliner revealed' : 'Secret headliner'}</Text>
                  </View>
                  {revealed ? (
                    <Text style={{ color: '#fbbf24', fontWeight: '900', fontSize: 20 }}>🎤 {event.secret_act}</Text>
                  ) : (
                    <>
                      <Text style={{ color: textColor, fontWeight: '900', fontSize: 20, letterSpacing: 4 }}>▓▓▓▓▓▓</Text>
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: 10 }}>
                        <View style={{ height: 6, width: `${pct}%`, backgroundColor: primary }} />
                      </View>
                      <Text style={{ color: textMuted, fontSize: 11, marginTop: 6 }}>{goingCount}/{threshold} RSVPs · {toGo} more to reveal</Text>
                    </>
                  )}
                  {revealed && <GlitterBurst trigger={secretFx} size={150} colors={['#fbbf24', '#fde047', '#ffffff', '#f0abfc']} />}
                </View>
              </View>
            );
          })()}

          {event?.rsvp_tiers?.length > 0 && (
            <SafeSection label="VIP Tiers" primary={primary}>
              <VIPTierSelector
                event={event}
                primary={primary}
                textColor={textColor}
                muted={textMuted}
                surface={surface}
                onBooked={() => {}}
              />
            </SafeSection>
          )}

          {/* Follow event button — shown to non-organisers */}
          {event?.id && !isOrganiser && (
            <SafeSection label="Follow" primary={primary}>
              <View style={{ paddingHorizontal: 16 }}>
                <EventFollowButton
                  eventId={event.id}
                  isSport={_isSportCat(event?.category)}
                />
              </View>
            </SafeSection>
          )}

          {isSoldOut && event?.id && (
            <SafeSection label="Waitlist" primary={primary}>
              <WaitlistButton
                eventId={event.id}
                primary={primary}
                muted={textMuted}
                surface={surface}
              />
            </SafeSection>
          )}

          {Array.isArray(event?.tags) && event.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {event.tags.map((tag, i) => (
                <View key={i} style={[styles.tagPill, { borderColor: primary + '55', backgroundColor: primary + '12' }]}>
                  <Text style={[styles.tagText, { color: primary }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {event?.id && (
            <SafeSection label="Reactions" primary={primary}>
              <EventReactions eventId={event.id} primary={primary} muted={textMuted} />
            </SafeSection>
          )}

          {/* Fan win-prediction (self-hides if the event has no teams to predict between) */}
          {event?.id && (
            <SafeSection label="Prediction" primary={primary}>
              <MatchPredictionCard eventId={event.id} primary={primary} />
            </SafeSection>
          )}

          {/* Tournament governance — vote for officials who control the data */}
          {event?.competition_id && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: `${primary}30`, backgroundColor: `${primary}10` }}
              onPress={() => setGovOpen(true)}
              activeOpacity={0.85}
            >
              <Feather name="users" size={18} color={primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: textColor, fontWeight: '900', fontSize: 14 }}>Tournament Governance</Text>
                <Text style={{ color: textMuted, fontSize: 11 }}>Vote for who controls results, the log & more</Text>
              </View>
              <Feather name="chevron-right" size={18} color={primary} />
            </TouchableOpacity>
          )}

          {/* Guests & Lineup — tagged players/performers; tap to view career */}
          {event?.id && (guests.length > 0 || isOrganiser) && (
            <View style={{ marginTop: 20, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 }}>
                <Text style={{ color: textColor, fontSize: 16, fontWeight: '900' }}>Guests & Lineup</Text>
                {isOrganiser && (
                  <TouchableOpacity
                    onPress={() => setGuestsModalOpen(true)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: `${primary}50`, backgroundColor: `${primary}12` }}
                  >
                    <Feather name="user-plus" size={13} color={primary} />
                    <Text style={{ color: primary, fontWeight: '800', fontSize: 12 }}>Manage</Text>
                  </TouchableOpacity>
                )}
              </View>
              {guests.length === 0 ? (
                <Text style={{ color: textMuted, fontSize: 12, paddingHorizontal: 16 }}>
                  Tag the players, performers or judges who’ll be here — they’ll show on their own profiles too.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                  {guests.map(gst => {
                    const p = gst.player || {};
                    const name = p.known_as || p.full_name || gst.guest_name || gst.profile?.username || 'Guest';
                    const photo = p.photo_url || gst.profile?.avatar_url;
                    return (
                      <TouchableOpacity
                        key={gst.id}
                        style={{ alignItems: 'center', width: 76 }}
                        activeOpacity={0.85}
                        onPress={() => { if (gst.player_id) setOpenGuestPlayer(gst.player_id); }}
                      >
                        {photo
                          ? <Image source={{ uri: photo }} style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: `${primary}50` }} />
                          : <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: `${primary}50`, backgroundColor: `${primary}18`, alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ color: primary, fontWeight: '900', fontSize: 20 }}>{name[0].toUpperCase()}</Text>
                            </View>}
                        <Text style={{ color: textColor, fontSize: 11, fontWeight: '700', marginTop: 5, textAlign: 'center' }} numberOfLines={1}>{name}</Text>
                        <Text style={{ color: textMuted, fontSize: 9, textAlign: 'center' }} numberOfLines={1}>
                          {[gst.role, gst.team_side].filter(Boolean).join(' · ')}
                        </Text>
                        {/* Hype heart — show the crowd which act they're here for */}
                        <TouchableOpacity
                          onPress={() => toggleGuestLike(gst.id)}
                          hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: guestLikes[gst.id]?.mine ? 'rgba(239,68,68,0.15)' : 'transparent' }}
                          accessibilityRole="button"
                          accessibilityLabel={`Hype ${name}`}
                        >
                          <Feather name="heart" size={11} color={guestLikes[gst.id]?.mine ? '#ef4444' : textMuted} />
                          <Text style={{ color: guestLikes[gst.id]?.mine ? '#ef4444' : textMuted, fontSize: 10, fontWeight: '800' }}>
                            {guestLikes[gst.id]?.count || 0}
                          </Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          {!!event?.ticket_url && (
            <TouchableOpacity
              style={[styles.ticketBtn, { backgroundColor: primary }]}
              onPress={openTickets}
              activeOpacity={0.85}
            >
              <Feather name="external-link" size={16} color="#000" />
              <Text style={styles.ticketBtnText}>Get Passes</Text>
            </TouchableOpacity>
          )}

          {/* Reminder + Check In row */}
          {user && (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 0 }}>
              <TouchableOpacity
                style={[styles.checkInBtn, {
                  backgroundColor: checkedIn ? "#10b981" : primary,
                  opacity: checkingIn ? 0.7 : 1,
                  flex: 1,
                }]}
                onPress={checkedIn ? () => { if (feature('crossedPaths')) setCrossedVisible(true); } : handleCheckIn}
                disabled={checkingIn}
                activeOpacity={0.85}
              >
                <Feather name={checkedIn ? 'users' : 'map-pin'} size={16} color="#000" />
                <Text style={styles.checkInBtnText}>
                  {checkingIn ? 'Touching Down...' : checkedIn ? 'Crossed Paths' : 'Touch Down'}
                </Text>
                <GlitterBurst trigger={checkinFx} size={160} colors={['#10b981', '#fde047', '#ffffff', '#34d399', '#f97316']} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.checkInBtn, {
                  backgroundColor: hasReminder ? `${primary}30` : 'transparent',
                  borderWidth: 1,
                  borderColor: hasReminder ? primary : 'rgba(255,255,255,0.2)',
                  opacity: settingReminder ? 0.6 : 1,
                }]}
                onPress={handleToggleReminder}
                disabled={settingReminder}
                activeOpacity={0.85}
              >
                <Feather name={hasReminder ? 'bell-off' : 'bell'} size={16} color={hasReminder ? primary : textMuted} />
                <Text style={[styles.checkInBtnText, { color: hasReminder ? primary : textMuted }]}>
                  {hasReminder ? 'Reminder On' : 'Remind Me'}
                </Text>
              </TouchableOpacity>

              {/* Add to device calendar */}
              <TouchableOpacity
                style={[styles.checkInBtn, {
                  backgroundColor: calendarAdded ? '#10b98130' : 'transparent',
                  borderWidth: 1,
                  borderColor: calendarAdded ? "#10b981" : 'rgba(255,255,255,0.2)',
                }]}
                onPress={handleAddToCalendar}
                disabled={calendarAdded}
                activeOpacity={0.85}
              >
                <Feather name={calendarAdded ? 'check-circle' : 'calendar'} size={16} color={calendarAdded ? "#10b981" : textMuted} />
                <Text style={[styles.checkInBtnText, { color: calendarAdded ? "#10b981" : textMuted }]}>
                  {calendarAdded ? 'In Calendar' : 'Add to Calendar'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {event && (
            <SafeSection label="Ads" primary={primary}>
              <EventContextualAds event={event} onNavigate={() => {}} />
            </SafeSection>
          )}

          <View style={styles.sectionDivider} />
          {event?.id && (
            <SafeSection label="Schedule" primary={primary}>
              <EventScheduleSection
                event={event}
                primary={primary}
                textColor={textColor}
                muted={textMuted}
                bg={background}
              />
            </SafeSection>
          )}

          {/* Vendor menu — food market / expo events */}
          {event?.id && ['food', 'market', 'pop-up', 'expo', 'fair', 'festival'].includes(event?.category?.toLowerCase()) && (
            <SafeSection label="Vendors" primary={primary}>
              <Text style={{ color: textColor, fontSize: 16, fontWeight: '900', paddingHorizontal: 16, marginBottom: 12 }}>
                Vendors & Stalls
              </Text>
              <VendorMenuSheet eventId={event.id} style={{ paddingHorizontal: 16 }} />
            </SafeSection>
          )}

          {/* Hackathon leaderboard — hackathon / competition events */}
          {event?.id && ['hackathon', 'competition', 'dance', 'talent', 'gaming', 'esports'].includes(event?.category?.toLowerCase()) && (
            <SafeSection label="Leaderboard" primary={primary}>
              <Text style={{ color: textColor, fontSize: 16, fontWeight: '900', paddingHorizontal: 16, marginBottom: 12 }}>
                Leaderboard
              </Text>
              <HackathonLeaderboard eventId={event.id} style={{ paddingHorizontal: 16 }} />
            </SafeSection>
          )}

          <View style={styles.sectionDivider} />
          {event?.id && (
            <SafeSection label="Carpool" primary={primary}>
              <CarpoolBoard
                event={event}
                primary={primary}
                textColor={textColor}
                muted={textMuted}
                surface={surface}
              />
              <ResidentLiftsSection
                eventId={event.id}
                primary={primary}
                surface={surface}
                textColor={textColor}
                muted={textMuted}
              />
            </SafeSection>
          )}

          {/* Stays — rooms/guesthouses near the event, from The Resident. Gated
              by feature('accommodation') + self-disabling on missing table, so
              it renders nothing until res_listings is live. */}
          {feature('accommodation') && event?.id && (event?.city || event?.suburb) && (
            <>
              <View style={styles.sectionDivider} />
              <SafeSection label="Stays" primary={primary}>
                <View style={{ paddingHorizontal: 16 }}>
                  <ResidentStaysSection
                    event={event}
                    primary={primary}
                    surface={surface}
                    textColor={textColor}
                    muted={textMuted}
                  />
                </View>
              </SafeSection>
            </>
          )}

          <View style={styles.sectionDivider} />
          {event?.id && (
            <SafeSection label="Continue the Night" primary={primary}>
              <ContinueTheNightCard event={event} checkedIn={checkedIn} onAuthRequired={onAuthRequired} />
            </SafeSection>
          )}

          <View style={styles.sectionDivider} />
          {event?.id && (
            <SafeSection label="Echoes" primary={primary}>
              <EchoSection eventId={event.id} onAuthRequired={onAuthRequired} />
            </SafeSection>
          )}

          <View style={styles.sectionDivider} />
          {event?.id && (
            <SafeSection label="Ratings" primary={primary}>
              <RatingSection eventId={event.id} onAuthRequired={onAuthRequired} />
            </SafeSection>
          )}

          {event?.id && isOrganiser && (
            <SafeSection label="Organizer Dashboard" primary={primary}>
              <OrganizerDashboard
                event={event}
                primary={primary}
                textColor={textColor}
                surface={surface}
                muted={textMuted}
              />
            </SafeSection>
          )}

          {/* ── Co-management action bar ──────────────────────────── */}
          {event?.id && (isOrganiser || isCoHost) && (
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 }}>
              {isOrganiser && (
                <TouchableOpacity
                  style={[styles.mgmtBtn, { borderColor: `${primary}40`, backgroundColor: `${primary}10` }]}
                  onPress={() => setRoleManagerVisible(true)}
                >
                  <Feather name="users" size={14} color={primary} />
                  <Text style={[styles.mgmtBtnText, { color: primary }]}>Manage Team</Text>
                </TouchableOpacity>
              )}
              {isOrganiser && (
                <TouchableOpacity
                  style={[styles.mgmtBtn, { borderColor: `${primary}40`, backgroundColor: `${primary}10` }]}
                  onPress={() => setInviteVisible(true)}
                >
                  <Feather name="user-plus" size={14} color={primary} />
                  <Text style={[styles.mgmtBtnText, { color: primary }]}>Invite My People</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.mgmtBtn, { borderColor: `${primary}40`, backgroundColor: `${primary}10` }]}
                onPress={() => setChatVisible(true)}
              >
                <Feather name="message-square" size={14} color={primary} />
                <Text style={[styles.mgmtBtnText, { color: primary }]}>Event Chat</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Tab switcher: Info / Manage / Polls / Playlist ──────── */}
          {event?.id && (
            <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: `${primary}20` }}>
              {[
                { key: 'info',    label: 'Info' },
                ...(isOrganiser || isCoHost ? [{ key: 'manage', label: '⚙️ Manage' }] : []),
                { key: 'polls',   label: 'Polls' },
                { key: 'playlist', label: 'Playlist' },
              ].map(tab => (
                <TouchableOpacity
                  key={tab.key}
                  style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: activeTab === tab.key ? `${primary}20` : 'transparent' }}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={{ color: activeTab === tab.key ? primary : textMuted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.sectionDivider} />

          {activeTab === 'manage' && event?.id && (isOrganiser || isCoHost) && (
            <SafeSection label="Event Management" primary={primary}>
              {/* Know your real fans — per-poster engagement (likes/reactions/
                  Touch Downs/reach) + who engages most. Host-only. */}
              <PosterInsightsPanel
                eventId={event.id}
                eventTitle={event.title}
                primary={primary}
                textColor={textColor}
                muted={textMuted}
              />
              {_isSportCat(event.category)
                ? <SportManagementPanel
                    event={event}
                    primary={primary}
                    textColor={textColor}
                    muted={textMuted}
                  />
                : <EventManagementPanel
                    event={event}
                    primary={primary}
                    textColor={textColor}
                    surface={surface}
                    muted={textMuted}
                  />
              }
            </SafeSection>
          )}

          {activeTab === 'polls' && event?.id && (
            <SafeSection label="Polls" primary={primary}>
              <EventPollSection eventId={event.id} canPost={canPost} />
            </SafeSection>
          )}

          {activeTab === 'playlist' && event?.id && (
            <SafeSection label="Playlist" primary={primary}>
              <EventPlaylistSection eventId={event.id} canModerate={canModerate} />
            </SafeSection>
          )}

          {activeTab === 'info' && event?.id && (
            <SafeSection label="Live Updates" primary={primary}>
              <LiveEventUpdates
                eventId={event.id}
                organiserId={organizer?.id}
                canPost={canPost}
                primary={primary}
                textColor={textColor}
                muted={textMuted}
                surface={surface}
              />
            </SafeSection>
          )}

          {event?.id && (
            <SafeSection label="Gallery" primary={primary}>
              <EventGallery eventId={event.id} />
            </SafeSection>
          )}

          <View style={styles.sectionDivider} />
          {media.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={[styles.sectionLabel, { color: textMuted }]}>EVENT PREVIEW</Text>
              <MediaViewer media={media} eventId={event?.id} onAuthRequired={onAuthRequired} />
            </View>
          )}

          <TouchableOpacity style={styles.reportBtn} onPress={handleReport}>
            <Feather name="flag" size={12} color={textMuted} />
            <Text style={[styles.reportText, { color: textMuted }]}>Report Gruv</Text>
          </TouchableOpacity>

        </ScrollView>

        <ReportModal
          visible={reportVisible}
          onClose={() => setReportVisible(false)}
          targetId={event?.id}
          targetType="event"
        />

        <CrossedPathsModal
          visible={crossedVisible}
          userId={user?.id}
          onClose={() => setCrossedVisible(false)}
          onAuthRequired={onAuthRequired}
        />

        {/* Chat FAB — always visible for signed-in users */}
        {user && event?.id && (
          <TouchableOpacity
            style={[styles.chatFab, { backgroundColor: primary, bottom: insets.bottom + 16 }]}
            onPress={() => setChatVisible(true)}
            activeOpacity={0.85}
          >
            <Feather name="message-circle" size={22} color="#000" />
          </TouchableOpacity>
        )}

        {chatVisible && (
          <SafeSection label="Event Chat" primary={primary}>
            <EventChatRoom
              visible={chatVisible}
              onClose={() => setChatVisible(false)}
              eventId={event?.id}
              eventTitle={event?.title}
              canModerate={canModerate}
            />
          </SafeSection>
        )}

        {isOrganiser && event?.id && (
          <SafeSection label="Role Manager" primary={primary}>
            <EventRoleManager
              visible={roleManagerVisible}
              onClose={() => setRoleManagerVisible(false)}
              eventId={event.id}
              organiserId={event.author_id ?? event.profiles?.id}
            />
          </SafeSection>
        )}

        {isOrganiser && event?.id && (
          <InviteByNameModal
            visible={inviteVisible}
            onClose={() => setInviteVisible(false)}
            event={event}
          />
        )}

        {isOrganiser && event?.id && guestsModalOpen && (
          <SafeSection label="Guests" primary={primary}>
            <EventGuestsModal
              visible={guestsModalOpen}
              eventId={event.id}
              category={event.category || event.sport_type || null}
              sportType={event.sport_type || null}
              onClose={() => setGuestsModalOpen(false)}
              onChanged={loadGuests}
            />
          </SafeSection>
        )}

        {openGuestPlayer && (
          <SafeSection label="Player" primary={primary}>
            <PlayerProfileModal
              visible={!!openGuestPlayer}
              playerId={openGuestPlayer}
              onClose={() => setOpenGuestPlayer(null)}
            />
          </SafeSection>
        )}

        {/* Tap the organizer's name/avatar → their full profile */}
        {organizerProfileOpen && organizer?.id && (
          <SafeSection label="Organizer" primary={primary}>
            <ViberProfileModal
              visible={organizerProfileOpen}
              userId={organizer.id}
              onClose={() => setOrganizerProfileOpen(false)}
            />
          </SafeSection>
        )}

        {govOpen && event?.competition_id && (
          <SafeSection label="Governance" primary={primary}>
            <TournamentGovernancePanel
              visible={govOpen}
              competitionId={event.competition_id}
              onClose={() => setGovOpen(false)}
            />
          </SafeSection>
        )}

        {/* Who's Going Modal */}
        <Modal visible={whoGoingVisible} animationType="slide" transparent onRequestClose={() => setWhoGoingVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
            <View style={[styles.whoGoingSheet, { backgroundColor: background }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[styles.whoGoingTitle, { color: textColor }]}>Who's Locked In ({whoGoing.length})</Text>
                <TouchableOpacity onPress={() => setWhoGoingVisible(false)}>
                  <Feather name="x" size={22} color={textColor} />
                </TouchableOpacity>
              </View>
              {whoGoing.length === 0
                ? <Text style={[{ color: textMuted, textAlign: 'center', paddingVertical: 32, fontSize: 14 }]}>No one has Vibed yet — be first!</Text>
                : whoGoing.map(p => (
                  <View key={p.id} style={[styles.whoGoingRow, { borderBottomColor: `${primary}15` }]}>
                    {p.avatar_url
                      ? <Image source={{ uri: thumb.avatar(p.avatar_url) }} style={styles.whoGoingAvatar} />
                      : <View style={[styles.whoGoingAvatar, { backgroundColor: ["#0891b2", "#7c3aed", "#059669", "#dc2626"][(p.username?.charCodeAt(0) || 0) % 4], alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ color: '#fff', fontWeight: '900' }}>{(p.username || 'V')[0].toUpperCase()}</Text>
                      </View>
                    }
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[{ color: textColor, fontWeight: '700', fontSize: 14 }]}>@{p.username}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text style={[{ color: primary, fontSize: 11, fontWeight: '600' }]}>⚡ {p.vibe_score || 0} pts</Text>
                        {p.social_integrity_score != null && (
                          <View style={[styles.sisBadge, { backgroundColor: `${primary}15`, borderColor: `${primary}30` }]}>
                            <Text style={{ color: primary, fontSize: 9, fontWeight: '700' }}>SIS {p.social_integrity_score}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                ))
              }
            </View>
          </View>
        </Modal>
      </View>
      {dmOpen && (
        <DirectMessageModal
          visible={dmOpen}
          recipient={organizer}
          onClose={() => setDmOpen(false)}
        />)}
      {giftingOpen && (
        <GiftingModal
          visible={giftingOpen}
          hostId={organizer?.id}
          eventId={event?.id}
          hostName={organizer?.username}
          onClose={() => setGiftingOpen(false)}
          onGiftSent={(gift) => {
            console.log('Gift sent successfully:', gift);
          }}
        />
      )}
    </Modal>
  );
};

const CountdownUnit = ({ value, label, primary, textColor }) => (
  <View style={{ alignItems: 'center', minWidth: 28 }}>
    <Text style={{ color: primary, fontSize: 18, fontWeight: '900', lineHeight: 20 }}>
      {String(value).padStart(2, '0')}
    </Text>
    <Text style={{ color: textColor, fontSize: 8, fontWeight: '700', opacity: 0.5, letterSpacing: 0.5 }}>{label}</Text>
  </View>
);

const MetaChip = ({ icon, label, color, pressable }) => (
  <View style={[styles.metaChip, pressable && { borderBottomWidth: 1, borderBottomColor: color + '88' }]}>
    <Feather name={icon} size={12} color={color} />
    <Text style={[styles.metaChipText, { color: pressable ? color : 'rgba(255,255,255,0.75)' }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    height: HERO_H,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  categoryText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroBtn: {
    position: 'absolute',
    top: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    left: 14,
  },
  shareBtn: {
    right: 14,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 48,
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#0d1112",
  },
  verifiedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: "#0d1112",
  },
  organizerMeta: {
    flex: 1,
    gap: 4,
  },
  organizerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  vibeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  vibeScore: {
    fontSize: 11,
    fontWeight: '700',
  },
  followBtn: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  messageOrganizerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  capacityCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  capacityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  capacityLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  spotsLeft: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  rsvpCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  rsvpRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rsvpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
  },
  rsvpBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tagPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  ticketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 4,
  },
  ticketBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 4,
    marginTop: 8,
  },
  checkInBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 20,
  },
  vibePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  vibeCountText: { fontSize: 12, fontWeight: '800' },
  countdownBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  countdownSep: { fontSize: 16, fontWeight: '900', marginBottom: 6 },
  countdownLabel: { fontSize: 11, fontWeight: '600', marginLeft: 4 },
  whoGoingSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '70%' },
  whoGoingTitle: { fontSize: 17, fontWeight: '900' },
  whoGoingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  whoGoingAvatar: { width: 42, height: 42, borderRadius: 21 },
  sisBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 24,
    paddingVertical: 8,
  },
  mgmtBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mgmtBtnText: { fontSize: 12, fontWeight: '900' },
  chatFab: {
    position: 'absolute',
    right: 18,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  reportText: {
    fontSize: 12,
  },
  ticketSection: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 14,
  },
  ticketSectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  ticketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  ticketTier: {
    flex: 1,
    minWidth: 100,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  ticketLabel: {
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  ticketValue: {
    fontSize: 15,
    fontWeight: '900',
  },
});

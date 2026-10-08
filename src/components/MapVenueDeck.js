/**
 * MapVenueDeck — Unified 3-State Interactive Bottom Deck.
 *
 * Replaces the fragmented floating bars and popup sheets with a cohesive,
 * tactile control deck inspired by modern high-end mobile UX:
 *
 *   • State 1: Peek (compact pulse indicator)
 *   • State 2: Card Carousel (swipeable venue cards synced to map camera)
 *   • State 3: Expanded (rich event intel: lineup, line status, Uber/directions)
 *
 * Zero drop shadows — razor-sharp 1px luminous hairline borders,
 * deep obsidian glass, and vivid emerald/cyan neon accents.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  Platform,
  Dimensions,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { SmartImage } from './SmartImage';
import { distanceKm } from '../utils/geo';
import { directionsUrl } from '../utils/directions';
import { SafeRoute } from '../services/safeRoute';
import { DoorStatusService, DOOR_LEVELS } from '../services/doorStatus';
import { RSVPManager, CheckInManager, BookmarkManager } from '../services/dataFlow';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { fx } from '../styles/webFx';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 330);

// Humane travel time
function travelLabel(km) {
  if (km == null) return null;
  if (km < 1.8) return `${Math.max(1, Math.round((km / 4.8) * 60))} min walk`;
  return `${Math.max(1, Math.round((km / 35) * 60))} min ride`;
}

export function MapVenueDeck({
  events = [],
  activeEventId = null,
  userCoords = null,
  onSelectEvent,
  onOpenEventDetail,
  onOpenWhoHere,
  onAuthRequired,
  primary = '#00f2ff',
  bg = '#080b0d',
  textColor = '#fff',
  muted = 'rgba(255,255,255,0.55)',
}) {
  const { user } = useAuth();
  const { show: toast } = useToast();

  const [deckState, setDeckState] = useState('carousel'); // 'peek' | 'carousel' | 'expanded'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [doorStatusMap, setDoorStatusMap] = useState({});
  const [rsvpStates, setRsvpStates] = useState({});
  const [savedStates, setSavedStates] = useState({});

  const scrollRef = useRef(null);
  const animHeight = useRef(new Animated.Value(235)).current;

  // Sync active event from parent (e.g. when user taps a pin on the map)
  useEffect(() => {
    if (!activeEventId || !events?.length) return;
    const idx = events.findIndex((e) => e.id === activeEventId);
    if (idx !== -1 && idx !== currentIndex) {
      setCurrentIndex(idx);
      scrollRef.current?.scrollTo({ x: idx * (CARD_WIDTH + 12), animated: true });
    }
  }, [activeEventId, events]);

  // Load door status for currently visible events
  useEffect(() => {
    let alive = true;
    const current = events[currentIndex];
    if (current?.id && !doorStatusMap[current.id]) {
      DoorStatusService.getStatus(current.id).then((status) => {
        if (alive) setDoorStatusMap((prev) => ({ ...prev, [current.id]: status }));
      });
    }
    return () => { alive = false; };
  }, [currentIndex, events, doorStatusMap]);

  // Animate deck height changes
  const transitionDeck = useCallback((state) => {
    setDeckState(state);
    const toValue = state === 'peek' ? 56 : state === 'expanded' ? 440 : 235;
    Animated.spring(animHeight, {
      toValue,
      friction: 9,
      tension: 50,
      useNativeDriver: false,
    }).start();
  }, [animHeight]);

  const handleCardScroll = (e) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + 12));
    if (index >= 0 && index < events.length && index !== currentIndex) {
      setCurrentIndex(index);
      const ev = events[index];
      if (ev) onSelectEvent?.(ev.id);
    }
  };

  const handleRsvp = async (ev) => {
    if (!user) { onAuthRequired?.(); return; }
    const current = rsvpStates[ev.id] || false;
    const next = !current;
    setRsvpStates((prev) => ({ ...prev, [ev.id]: next }));
    try {
      await RSVPManager.upsert(ev.id, user.id, next ? 'going' : 'not_going');
      toast(next ? 'Locked in! See you there.' : 'Removed from plans.', 'success');
    } catch {
      setRsvpStates((prev) => ({ ...prev, [ev.id]: current }));
      toast('Could not update RSVP.', 'error');
    }
  };

  const handleSave = async (ev) => {
    if (!user) { onAuthRequired?.(); return; }
    const current = savedStates[ev.id] || false;
    const next = !current;
    setSavedStates((prev) => ({ ...prev, [ev.id]: next }));
    try {
      if (next) await BookmarkManager.add(user.id, ev.id);
      else await BookmarkManager.remove(user.id, ev.id);
      toast(next ? 'Saved to bookmarks.' : 'Removed from bookmarks.', 'info');
    } catch {
      setSavedStates((prev) => ({ ...prev, [ev.id]: current }));
    }
  };

  const handleRide = (ev) => {
    const lat = ev.lat ?? ev.latitude;
    const lng = ev.lon ?? ev.longitude;
    if (lat && lng) {
      SafeRoute.launchUber(lat, lng, ev.venue_name || ev.title);
    } else {
      toast('Venue coordinates unavailable.', 'info');
    }
  };

  const handleDirections = (ev) => {
    const lat = ev.lat ?? ev.latitude;
    const lng = ev.lon ?? ev.longitude;
    if (lat && lng) {
      const url = directionsUrl({ lat, lon: lng, label: ev.venue_name || ev.title }, userCoords, Platform.OS);
      if (url && typeof window !== 'undefined') window.open(url, '_blank');
    }
  };

  const activeEvent = events[currentIndex] || events[0];

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <Animated.View style={[s.deckContainer, { height: animHeight, backgroundColor: 'rgba(10,14,16,0.96)' }]}>
      {/* Deck Header & Grip Bar */}
      <TouchableOpacity
        style={s.gripBar}
        activeOpacity={0.8}
        onPress={() => transitionDeck(deckState === 'carousel' ? 'expanded' : deckState === 'expanded' ? 'carousel' : 'carousel')}
      >
        <View style={s.pillIndicator} />
        <View style={s.headerRow}>
          <View style={s.pulseStat}>
            <View {...fx('beat')} style={s.radarGreenDot} />
            <Text style={[s.pulseStatText, { color: '#10b981' }]}>
              {events.filter((e) => (e.here_count || 0) > 0).length} Live Now
            </Text>
            <Text style={{ color: muted, fontSize: 11 }}>·</Text>
            <Text style={[s.pulseStatText, { color: textColor }]}>
              {events.length} Hotspots in view
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => transitionDeck(deckState === 'peek' ? 'carousel' : 'peek')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather
              name={deckState === 'peek' ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={muted}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* State 2: Swipeable Horizontal Carousel */}
      {deckState !== 'peek' && (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled={false}
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + 12}
          decelerationRate="fast"
          onMomentumScrollEnd={handleCardScroll}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 12 }}
        >
          {events.map((ev, idx) => {
            const here = Number(ev.here_count || 0);
            const isLive = here > 0;
            const lat = ev.lat ?? ev.latitude;
            const lng = ev.lon ?? ev.longitude;
            const dist = userCoords && lat && lng ? distanceKm(userCoords.lat, userCoords.lng, lat, lng) : null;
            const isSaved = savedStates[ev.id] || false;
            const isGoing = rsvpStates[ev.id] || false;
            const door = doorStatusMap[ev.id] || DOOR_LEVELS.walk_in;
            const cover = ev.cover_url || ev.image_url || ev.image;
            const isSecret = !!(ev.is_secret || ev.secret_act);

            return (
              <View
                key={ev.id}
                {...fx('rim rise', idx)}
                style={[
                  s.card,
                  {
                    width: CARD_WIDTH,
                    borderColor: idx === currentIndex ? primary : 'rgba(255,255,255,0.12)',
                    backgroundColor: 'rgba(14,18,21,0.92)',
                  },
                ]}
              >
                {/* Top Info Row */}
                <TouchableOpacity
                  style={s.cardTop}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${ev.title || 'this venue'} on the map`}
                  onPress={() => { setCurrentIndex(idx); onSelectEvent?.(ev.id); }}
                >
                  {cover ? (
                    <SmartImage source={cover} style={s.cardCover} />
                  ) : (
                    <View style={[s.cardCover, { backgroundColor: `${primary}18`, alignItems: 'center', justifyContent: 'center' }]}>
                      <Feather name="music" size={20} color={primary} />
                    </View>
                  )}

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {isLive ? (
                        <TouchableOpacity
                          style={s.liveBadge}
                          activeOpacity={0.8}
                          onPress={() => onOpenWhoHere?.(ev.id)}
                        >
                          <View {...fx('beat')} style={s.liveDotPulse} />
                          <Text style={s.liveBadgeText}>{here} In The Room</Text>
                          <Feather name="chevron-right" size={10} color="#10b981" />
                        </TouchableOpacity>
                      ) : (
                        <View style={[s.catBadge, { backgroundColor: `${primary}18` }]}>
                          <Text style={[s.catBadgeText, { color: primary }]}>
                            {ev.category || 'Nightlife'}
                          </Text>
                        </View>
                      )}

                      {/* Door Line Reality Badge */}
                      <View style={[s.doorBadge, { backgroundColor: door.badgeBg, borderColor: `${door.color}40` }]}>
                        <Feather name={door.icon} size={10} color={door.color} />
                        <Text style={[s.doorBadgeText, { color: door.color }]}>{door.waitEstimate}</Text>
                      </View>
                    </View>

                    <Text style={[s.cardTitle, { color: textColor }]} numberOfLines={1}>
                      {ev.title || ev.venue_name || 'Event'}
                    </Text>

                    <Text style={[s.cardVenue, { color: muted }]} numberOfLines={1}>
                      {ev.venue_name || 'Venue'}
                      {ev.suburb ? ` · ${ev.suburb}` : ''}
                      {dist != null ? ` · ${travelLabel(dist)}` : ''}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleSave(ev)}
                    style={s.bookmarkBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather
                      name={isSaved ? 'bookmark' : 'bookmark'}
                      size={17}
                      color={isSaved ? primary : muted}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>

                {/* Secret Drop Countdown Alert */}
                {isSecret && (
                  <View style={s.secretDropBanner}>
                    <Feather name="lock" size={12} color="#a855f7" />
                    <Text style={s.secretDropText}>
                      Secret Underground Drop · Exact spot unlocks for ticket holders
                    </Text>
                  </View>
                )}

                {/* Action Bar */}
                <View style={s.cardActions}>
                  <TouchableOpacity
                    style={[
                      s.rsvpBtn,
                      {
                        backgroundColor: isGoing ? primary : 'rgba(255,255,255,0.06)',
                        borderColor: isGoing ? primary : 'rgba(255,255,255,0.14)',
                      },
                    ]}
                    onPress={() => handleRsvp(ev)}
                  >
                    <Feather
                      name={isGoing ? 'check' : 'zap'}
                      size={13}
                      color={isGoing ? '#000' : primary}
                    />
                    <Text style={[s.rsvpBtnText, { color: isGoing ? '#000' : textColor }]}>
                      {isGoing ? 'Locked In' : 'Lock In'}
                    </Text>
                  </TouchableOpacity>

                  {/* 1-Tap Uber Ride */}
                  <TouchableOpacity
                    style={s.iconActionBtn}
                    onPress={() => handleRide(ev)}
                    accessibilityLabel="Request Uber"
                  >
                    <Feather name="navigation" size={14} color="#f59e0b" />
                  </TouchableOpacity>

                  {/* Directions */}
                  <TouchableOpacity
                    style={s.iconActionBtn}
                    onPress={() => handleDirections(ev)}
                    accessibilityLabel="Directions"
                  >
                    <Feather name="map-pin" size={14} color={primary} />
                  </TouchableOpacity>

                  {/* Open Details */}
                  <TouchableOpacity
                    style={s.detailBtn}
                    onPress={() => onOpenEventDetail?.(ev.id)}
                  >
                    <Text style={[s.detailBtnText, { color: textColor }]}>Details</Text>
                    <Feather name="arrow-up-right" size={13} color={textColor} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* State 3: Expanded Full Details View */}
      {deckState === 'expanded' && activeEvent && (
        <ScrollView style={s.expandedScroll} showsVerticalScrollIndicator={false}>
          <View style={s.expandedContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[s.expandedHeading, { color: textColor }]}>Event Intelligence</Text>
              <TouchableOpacity onPress={() => transitionDeck('carousel')}>
                <Feather name="minimize-2" size={16} color={muted} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: muted, fontSize: 13, lineHeight: 18, marginTop: 6 }}>
              {activeEvent.description || 'Verified live venue on The Gruvs network.'}
            </Text>

            {/* Door Line Quick Reporter */}
            <View style={s.doorReportSection}>
              <Text style={[s.doorSectionTitle, { color: textColor }]}>Report Door Reality</Text>
              <View style={s.doorButtonsRow}>
                {Object.values(DOOR_LEVELS).map((lvl) => (
                  <TouchableOpacity
                    key={lvl.key}
                    style={[
                      s.doorPickPill,
                      {
                        backgroundColor: lvl.badgeBg,
                        borderColor: `${lvl.color}40`,
                      },
                    ]}
                    onPress={() => {
                      DoorStatusService.reportStatus(activeEvent.id, user?.id, lvl.key).then(() => {
                        setDoorStatusMap((prev) => ({ ...prev, [activeEvent.id]: lvl }));
                        toast(`Reported: ${lvl.label}`, 'success');
                      });
                    }}
                  >
                    <Feather name={lvl.icon} size={12} color={lvl.color} />
                    <Text style={[s.doorPickText, { color: lvl.color }]}>{lvl.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[s.fullEventPageBtn, { backgroundColor: primary }]}
              onPress={() => onOpenEventDetail?.(activeEvent.id)}
            >
              <Text style={s.fullEventPageBtnText}>Open Full Event Page</Text>
              <Feather name="arrow-right" size={15} color="#000" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  deckContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    zIndex: 35,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' } : {}),
  },
  gripBar: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  pillIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 8,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pulseStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  radarGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  pulseStatText: {
    fontSize: 12,
    fontWeight: '800',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    justifyContent: 'space-between',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardCover: {
    width: 58,
    height: 58,
    borderRadius: 14,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.16)',
    borderColor: 'rgba(16,185,129,0.40)',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  liveDotPulse: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  liveBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
  },
  catBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  doorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  doorBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  cardVenue: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  bookmarkBtn: {
    padding: 6,
    alignSelf: 'flex-start',
  },
  secretDropBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(168,85,247,0.14)',
    borderColor: 'rgba(168,85,247,0.30)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  secretDropText: {
    color: '#c084fc',
    fontSize: 10,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rsvpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  rsvpBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
  },
  detailBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  expandedScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  expandedContent: {
    paddingBottom: 24,
    gap: 12,
  },
  expandedHeading: {
    fontSize: 16,
    fontWeight: '900',
  },
  doorReportSection: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    marginTop: 4,
  },
  doorSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  doorButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  doorPickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  doorPickText: {
    fontSize: 11,
    fontWeight: '700',
  },
  fullEventPageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
  },
  fullEventPageBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
  },
});

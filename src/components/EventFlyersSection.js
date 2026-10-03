/**
 * EventFlyersSection — Digital Flyer Deck for In-Event Attendees.
 *
 * Displays promotional drops, perks, and flyers spread by local businesses,
 * sponsors, and creators to this event's audience.
 *
 * Attendees can claim perks, copy codes, and see who's offering specials.
 * Businesses and creators can tap "Spread Flyer Here" to launch EventFlyerSpreadModal.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { EventFlyerService, TARGET_AUDIENCES } from '../services/eventFlyerService';
import { ControlledGlitterBurst } from './ControlledGlitterBurst';
import { EventFlyerSpreadModal } from './EventFlyerSpreadModal';
import { haptics } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

export function EventFlyersSection({
  event,
  primary = '#00f2ff',
  textColor = '#fff',
  muted = 'rgba(255,255,255,0.55)',
  surface = '#111618',
  onAuthRequired,
}) {
  const { user } = useAuth();
  const { show: toast } = useToast();

  const [flyers, setFlyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [spreadModalVisible, setSpreadModalVisible] = useState(false);
  const [claimedFlyers, setClaimedFlyers] = useState({});
  const [claimGlitters, setClaimGlitters] = useState({});

  const loadFlyers = useCallback(async () => {
    if (!event?.id) return;
    try {
      const list = await EventFlyerService.getFlyersForEvent(event.id);
      setFlyers(list);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, [event?.id]);

  useEffect(() => {
    loadFlyers();
  }, [loadFlyers]);

  const handleClaim = async (flyer) => {
    if (!user && onAuthRequired) {
      onAuthRequired();
      return;
    }
    haptics.success?.();
    setClaimGlitters((prev) => ({ ...prev, [flyer.id]: Date.now() }));
    setClaimedFlyers((prev) => ({ ...prev, [flyer.id]: true }));

    await EventFlyerService.claimFlyer(flyer.id, user?.id);

    if (flyer.perk_code) {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(flyer.perk_code).catch(() => {});
      }
      toast?.(`Perk code "${flyer.perk_code}" claimed & copied! 🎟️`, 'success');
    } else {
      toast?.(`Perk claimed! Present this flyer at the venue.`, 'success');
    }
  };

  const handleOpenSpread = () => {
    if (!user && onAuthRequired) {
      onAuthRequired();
      return;
    }
    setSpreadModalVisible(true);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Feather name="send" size={15} color={primary} />
            <Text style={[styles.headerTitle, { color: textColor }]}>In-Event Flyers & Drops</Text>
            {flyers.length > 0 && (
              <View style={[styles.badge, { backgroundColor: `${primary}20`, borderColor: `${primary}45` }]}>
                <Text style={[styles.badgeText, { color: primary }]}>{flyers.length} Active</Text>
              </View>
            )}
          </View>
          <Text style={[styles.headerSub, { color: muted }]}>
            Digital perks & specials spread exclusively to this crowd
          </Text>
        </View>

        {/* Spread flyer action */}
        <TouchableOpacity
          onPress={handleOpenSpread}
          style={[styles.spreadBtn, { borderColor: `${primary}55`, backgroundColor: `${primary}12` }]}
          activeOpacity={0.8}
        >
          <Feather name="plus-circle" size={13} color={primary} />
          <Text style={[styles.spreadBtnText, { color: primary }]}>Spread Flyer</Text>
        </TouchableOpacity>
      </View>

      {/* Flyers list */}
      {flyers.length === 0 ? (
        <View style={[styles.emptyBox, { borderColor: `${primary}20` }]}>
          <Feather name="radio" size={24} color={muted} style={{ marginBottom: 6 }} />
          <Text style={[styles.emptyTitle, { color: textColor }]}>No flyers spread yet</Text>
          <Text style={[styles.emptySub, { color: muted }]}>
            Have a business, brand, or afterparty? AirDrop your flyer to everyone at this event!
          </Text>
          <TouchableOpacity
            onPress={handleOpenSpread}
            style={[styles.emptySpreadBtn, { backgroundColor: primary }]}
            activeOpacity={0.85}
          >
            <Feather name="send" size={14} color="#000" />
            <Text style={styles.emptySpreadBtnText}>Throw Flyer to Crowd</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollList}
        >
          {flyers.map((flyer) => {
            const targetMeta = TARGET_AUDIENCES[flyer.target_audience] || TARGET_AUDIENCES.here_now;
            const isClaimed = !!claimedFlyers[flyer.id];

            return (
              <View
                key={flyer.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: surface,
                    borderColor: `${targetMeta.color}45`,
                  },
                ]}
              >
                {/* Top target tag */}
                <View style={styles.cardTopRow}>
                  <View style={[styles.targetBadge, { backgroundColor: `${targetMeta.color}15`, borderColor: `${targetMeta.color}35` }]}>
                    <Feather name={targetMeta.icon} size={10} color={targetMeta.color} />
                    <Text style={[styles.targetBadgeText, { color: targetMeta.color }]}>{targetMeta.badge}</Text>
                  </View>
                  <Text style={[styles.bizName, { color: muted }]} numberOfLines={1}>
                    {flyer.business_name}
                  </Text>
                </View>

                {/* Content */}
                <Text style={[styles.cardTitle, { color: textColor }]} numberOfLines={2}>
                  {flyer.title}
                </Text>

                {flyer.description ? (
                  <Text style={[styles.cardDesc, { color: muted }]} numberOfLines={2}>
                    {flyer.description}
                  </Text>
                ) : null}

                {/* Perk code */}
                {flyer.perk_code ? (
                  <View style={[styles.codeWrap, { borderColor: `${primary}35`, backgroundColor: 'rgba(0,0,0,0.45)' }]}>
                    <Feather name="tag" size={12} color={primary} />
                    <Text style={[styles.codeText, { color: primary }]}>{flyer.perk_code}</Text>
                  </View>
                ) : null}

                {/* Action button */}
                <TouchableOpacity
                  onPress={() => handleClaim(flyer)}
                  style={[
                    styles.claimBtn,
                    {
                      backgroundColor: isClaimed ? '#10b981' : primary,
                      position: 'relative',
                    },
                  ]}
                  activeOpacity={0.85}
                >
                  <Feather name={isClaimed ? 'check' : 'zap'} size={13} color="#000" />
                  <Text style={styles.claimBtnText}>
                    {isClaimed ? 'Perk Claimed' : flyer.cta_text || 'Claim Perk'}
                  </Text>
                  <ControlledGlitterBurst
                    trigger={claimGlitters[flyer.id]}
                    count={12}
                    radius={30}
                    colors={[primary, '#ffd700', '#fff', '#10b981']}
                  />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Spread Modal */}
      {spreadModalVisible && (
        <EventFlyerSpreadModal
          visible={spreadModalVisible}
          event={event}
          onClose={() => {
            setSpreadModalVisible(false);
            loadFlyers();
          }}
          primary={primary}
          textColor={textColor}
          muted={muted}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '900',
  },
  spreadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  spreadBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  emptyBox: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 14,
    maxWidth: 280,
  },
  emptySpreadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
  },
  emptySpreadBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
  },
  scrollList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    width: 230,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  targetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  targetBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  bizName: {
    fontSize: 10,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  cardDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  codeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignSelf: 'flex-start',
  },
  codeText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    marginTop: 4,
  },
  claimBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { money } from '../constants/currencies';

// Expo Haptics — optional dependency, graceful fallback
let Haptics = null;
try {
  Haptics = require('expo-haptics');
} catch {
  // Not installed — haptics silently skipped
}

const CATEGORY_COLORS = {
  moving:   "#f97316", // orange
  assembly: "#8b5cf6", // purple
  packing:  "#3b82f6", // blue
  crew:     "#10b981", // green
};

const CATEGORY_ICONS = {
  moving:   'truck',
  assembly: 'tool',
  packing:  'box',
  crew:     'users',
};

function getInitials(name = '') {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * GigModeCard
 *
 * Props:
 *  gig        — gig data object
 *  onAccept   — callback(gig) called when user taps Accept
 *  primary    — theme primary color
 *  muted      — theme muted text color
 *  textColor  — main text color
 *  bg         — card background color
 */
export function GigModeCard({ gig, onAccept, primary, muted, textColor, bg }) {
  const [accepted, setAccepted] = useState(false);

  const category = gig?.category ?? 'moving';
  const accentColor = CATEGORY_COLORS[category] ?? primary ?? "#f97316";
  const iconName = CATEGORY_ICONS[category] ?? 'truck';

  const rawPay = gig?.pay_rands ?? gig?.pay ?? 0;
  const payRands = typeof rawPay === 'number' ? money(rawPay) : String(rawPay || money(0));

  const distance = gig?.distance_km != null
    ? `${gig.distance_km} km`
    : gig?.distance ?? '? km';

  const timeWindow = gig?.time_window ?? 'Flexible';
  const posterName = gig?.poster_username ?? gig?.profiles?.username ?? 'Unknown';
  const sisScore = gig?.sis_score ?? gig?.social_integrity_score ?? gig?.profiles?.social_integrity_score ?? 0;

  const handleAccept = async () => {
    if (accepted) return;

    try {
      await Haptics?.selectionAsync?.();
    } catch {
      // ignore haptics errors
    }

    setAccepted(true);
    onAccept?.(gig);
  };

  const cardBorderColor = accepted ? "#10b981" : 'transparent';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: bg ?? "#1a1a2e",
          borderColor: cardBorderColor,
          borderWidth: accepted ? 1.5 : 0,
        },
      ]}
    >
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      {/* Card body */}
      <View style={styles.body}>
        {/* Top row: icon + title */}
        <View style={styles.topRow}>
          <View style={[styles.iconWrap, { backgroundColor: accentColor + '22' }]}>
            <Feather name={iconName} size={18} color={accentColor} />
          </View>
          <View style={styles.titleBlock}>
            <Text
              style={[styles.title, { color: textColor ?? '#fff' }]}
              numberOfLines={1}
            >
              {gig?.title ?? 'Gig Opportunity'}
            </Text>
            <Text
              style={[styles.description, { color: muted ?? "#9ca3af" }]}
              numberOfLines={2}
            >
              {gig?.description ?? 'No description provided.'}
            </Text>
          </View>
        </View>

        {/* Pills row */}
        <View style={styles.pillsRow}>
          {/* Distance pill */}
          <View style={[styles.pill, { backgroundColor: accentColor + '22' }]}>
            <Feather name="map-pin" size={11} color={accentColor} />
            <Text style={[styles.pillText, { color: accentColor }]}>{distance}</Text>
          </View>

          {/* Time window pill */}
          <View style={[styles.pill, { backgroundColor: '#ffffff12' }]}>
            <Feather name="clock" size={11} color={muted ?? "#9ca3af"} />
            <Text style={[styles.pillText, { color: muted ?? "#9ca3af" }]}>{timeWindow}</Text>
          </View>
        </View>

        {/* Bottom row: poster info + pay + accept button */}
        <View style={styles.bottomRow}>
          {/* Poster */}
          <View style={styles.posterRow}>
            <View style={[styles.avatar, { backgroundColor: primary ?? "#f97316" }]}>
              <Text style={styles.avatarText}>{getInitials(posterName)}</Text>
            </View>
            <View style={styles.posterInfo}>
              <Text style={[styles.posterName, { color: textColor ?? '#fff' }]} numberOfLines={1}>
                {posterName}
              </Text>
              {/* SIS score badge */}
              <View style={styles.sisBadge}>
                <Feather name="shield" size={11} color="#06b6d4" />
                <Text style={styles.sisText}>{sisScore}</Text>
              </View>
            </View>
          </View>

          {/* Pay + Accept */}
          <View style={styles.rightBlock}>
            <Text style={styles.pay}>{payRands}</Text>
            <TouchableOpacity
              style={[
                styles.acceptBtn,
                {
                  backgroundColor: accepted ? "#10b981" : (primary ?? "#f97316"),
                },
              ]}
              onPress={handleAccept}
              activeOpacity={0.75}
            >
              {accepted ? (
                <>
                  <Feather name="check" size={13} color="#fff" />
                  <Text style={styles.acceptText}>Accepted</Text>
                </>
              ) : (
                <Text style={styles.acceptText}>Accept Gig</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    marginVertical: 6,
    overflow: 'hidden',
    // subtle glass shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  accentBar: {
    width: 4,
    borderRadius: 2,
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  posterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  posterInfo: {
    gap: 2,
  },
  posterName: {
    fontSize: 12,
    fontWeight: '600',
  },
  sisBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sisText: {
    fontSize: 11,
    color: "#06b6d4",
    fontWeight: '600',
  },
  rightBlock: {
    alignItems: 'flex-end',
    gap: 6,
  },
  pay: {
    fontSize: 18,
    fontWeight: '800',
    color: "#10b981",
    letterSpacing: 0.5,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  acceptText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});

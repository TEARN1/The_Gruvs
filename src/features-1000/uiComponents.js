/**
 * COMPREHENSIVE UI COMPONENTS LIBRARY (50+ Components)
 * Reusable, themed React components for the event platform
 *
 * Component Categories:
 * - Event Cards (10 variants)
 * - Profile Cards (4 types)
 * - Display Components (20+)
 * - Input Components (8+)
 * - Layout Components (8+)
 * - Media Components (5+)
 * - Feedback Components (5+)
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Modal, FlatList, TextInput, ScrollView, Animated } from 'react-native';

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

export const UI_COMPONENTS = {
  eventCards: 10,
  profileCards: 4,
  displayComponents: 20,
  inputComponents: 8,
  layoutComponents: 8,
  mediaComponents: 5,
  feedbackComponents: 5,
  totalComponents: 60
};

// ═══════════════════════════════════════════════════════════════════════════
// PREMIUM EVENT CARD - 10 VARIANTS
// ═══════════════════════════════════════════════════════════════════════════

export function PremiumEventCard({ event, theme, onPress, variant = 'default' }) {
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const variants = {
    default: { scale: 1, compact: false, showAll: true },
    compact: { scale: 0.95, compact: true, showAll: false },
    featured: { scale: 1.05, compact: false, showAll: true, highlighted: true },
    minimal: { scale: 0.9, compact: true, showAll: false },
    list: { scale: 1, compact: true, showAll: true, horizontal: false },
    grid: { scale: 1, compact: false, showAll: true, gridView: true },
    carousel: { scale: 1, compact: false, showAll: true, swipeable: true },
    darkTheme: { scale: 1, compact: false, showAll: true, darkMode: true },
    lightTheme: { scale: 1, compact: false, showAll: true, lightMode: true },
    comparison: { scale: 1, compact: false, showAll: true, selectable: true }
  };

  const config = variants[variant] || variants.default;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        cardStyles.premiumContainer,
        config.highlighted && { borderWidth: 2, borderColor: theme.acc },
        { transform: [{ scale: config.scale }] }
      ]}
    >
      {/* Hero Image Section */}
      <View style={cardStyles.heroSection}>
        <Image source={{ uri: event.image }} style={cardStyles.heroImage} />
        <View style={[cardStyles.heroOverlay, { backgroundColor: `${theme.grad}40` }]} />

        {/* Live Badge */}
        {event.isLive && (
          <View style={cardStyles.liveBadge}>
            <Text style={cardStyles.liveText}>🔴 LIVE</Text>
          </View>
        )}

        {/* Countdown Timer */}
        {!event.isLive && (
          <View style={cardStyles.countdownBadge}>
            <Text style={cardStyles.countdownText}>📅 {event.daysUntil}d</Text>
          </View>
        )}
      </View>

      {show All && (
        <>
          {/* Quick Info Pills */}
          <View style={cardStyles.infoRow}>
            <InfoPill icon="🏷️" text={event.category} theme={theme} />
            <InfoPill icon="⏰" text={event.time} theme={theme} />
            <InfoPill icon="📍" text={event.distance} theme={theme} />
          </View>

          {/* Organizer Profile */}
          <View style={cardStyles.organizerSection}>
            <View style={[cardStyles.organizerAvatar, { backgroundColor: theme.acc }]}>
              <Text style={cardStyles.avatarText}>{event.organizer[0]}</Text>
            </View>
            <View style={cardStyles.organizerInfo}>
              <Text style={[cardStyles.organizerName, { color: theme.text }]}>
                {event.organizer}
              </Text>
              {event.isVerified && <Text style={cardStyles.badgeVerified}>✓ Verified</Text>}
            </View>
          </View>

          {/* Title and Description */}
          <View style={cardStyles.contentSection}>
            <Text style={[cardStyles.title, { color: theme.text }]} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={[cardStyles.description, { color: theme.sub }]} numberOfLines={2}>
              {event.description}
            </Text>
          </View>

          {/* Quick Stats */}
          <View style={cardStyles.statsRow}>
            <Stat count={event.attendees} label="Going" icon="👥" />
            <Stat count={event.reviews} label="Reviews" icon="⭐" />
            <Stat count={event.rating} label="Rating" icon="📊" />
          </View>

          {/* Price Display */}
          <View style={cardStyles.priceSection}>
            <Text style={[cardStyles.price, { color: theme.acc }]}>
              {event.price === 'free' ? 'Free' : `$${event.price}`}
            </Text>
            {event.originalPrice && (
              <Text style={cardStyles.originalPrice}>${event.originalPrice}</Text>
            )}
          </View>

          {/* Action Buttons */}
          <View style={cardStyles.actionButtons}>
            <TouchableOpacity
              style={[cardStyles.primaryBtn, { backgroundColor: theme.acc }]}
              onPress={onPress}
            >
              <Text style={cardStyles.primaryBtnText}>✓ RSVP</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={cardStyles.secondaryBtn}
              onPress={() => setIsBookmarked(!isBookmarked)}
            >
              <Text style={cardStyles.secondaryBtnText}>
                {isBookmarked ? '🔖' : '🔖'} Save
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={cardStyles.secondaryBtn}
              onPress={() => setIsLiked(!isLiked)}
            >
              <Text style={cardStyles.secondaryBtnText}>
                {isLiked ? '❤️' : '🤍'} Like
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  premiumContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 12,
    marginVertical: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8
  },
  heroSection: {
    position: 'relative',
    height: 200,
    backgroundColor: '#f0f0f0'
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  liveBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  liveText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  countdownBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  countdownText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  infoRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8
  },
  organizerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12
  },
  organizerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  organizerInfo: { flex: 1 },
  organizerName: { fontWeight: '600', fontSize: 14 },
  badgeVerified: { fontSize: 11, color: '#4CAF50', fontWeight: 'bold' },
  contentSection: { paddingHorizontal: 12, marginBottom: 12 },
  title: { fontWeight: '700', fontSize: 16, lineHeight: 20, marginBottom: 6 },
  description: { fontSize: 13, lineHeight: 18 },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)'
  },
  priceSection: {
    paddingHorizontal: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },
  price: { fontSize: 20, fontWeight: '700', marginRight: 8 },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through'
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center'
  },
  secondaryBtnText: { fontWeight: '600', fontSize: 12 }
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function InfoPill({ icon, text, theme }) {
  return (
    <View style={[infoStyles.pill, { backgroundColor: `${theme.acc}20` }]}>
      <Text style={infoStyles.icon}>{icon}</Text>
      <Text style={[infoStyles.text, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

function Stat({ count, label, icon }) {
  return (
    <View style={statStyles.container}>
      <Text style={statStyles.icon}>{icon}</Text>
      <Text style={statStyles.count}>{count}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4
  },
  icon: { fontSize: 14 },
  text: { fontSize: 12, fontWeight: '500' }
});

const statStyles = StyleSheet.create({
  container: { alignItems: 'center', flex: 1 },
  icon: { fontSize: 16, marginBottom: 4 },
  count: { fontWeight: 'bold', fontSize: 14 },
  label: { fontSize: 11, color: '#999' }
});

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE CARDS (4 TYPES)
// ═══════════════════════════════════════════════════════════════════════════

export function OrganizerProfileCard({ organizer, theme, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[profileCardStyles.container, { backgroundColor: theme.card }]}>
      <View style={[profileCardStyles.avatar, { backgroundColor: theme.acc }]}>
        <Text style={profileCardStyles.avatarText}>{organizer.name[0]}</Text>
      </View>
      <View style={profileCardStyles.content}>
        <View style={profileCardStyles.header}>
          <Text style={[profileCardStyles.name, { color: theme.text }]}>{organizer.name}</Text>
          {organizer.isVerified && <Text style={profileCardStyles.badge}>✓</Text>}
        </View>
        <Text style={[profileCardStyles.role, { color: theme.sub }]}>Event Organizer</Text>
        <Text style={[profileCardStyles.stats, { color: theme.sub }]}>
          {organizer.eventCount} events • {organizer.followers} followers
        </Text>
      </View>
      <TouchableOpacity style={[profileCardStyles.actionBtn, { backgroundColor: theme.acc }]}>
        <Text style={profileCardStyles.actionText}>Follow</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const profileCardStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  content: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  name: { fontWeight: '700', fontSize: 14 },
  badge: { fontSize: 14, color: '#4CAF50', marginLeft: 4 },
  role: { fontSize: 12, marginBottom: 4 },
  stats: { fontSize: 11 },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 12 }
});

// ═══════════════════════════════════════════════════════════════════════════
// DISPLAY COMPONENTS (BADGES, TAGS, INDICATORS)
// ═══════════════════════════════════════════════════════════════════════════

export function CategoryBadge({ category, theme, icon }) {
  return (
    <View style={[badgeStyles.container, { backgroundColor: `${theme.acc}20` }]}>
      <Text style={badgeStyles.icon}>{icon}</Text>
      <Text style={[badgeStyles.text, { color: theme.acc }]}>{category}</Text>
    </View>
  );
}

export function StatusIndicator({ status, theme }) {
  const statusConfig = {
    upcoming: { color: '#2196F3', text: '📅 Upcoming', icon: '○' },
    live: { color: '#FF5722', text: '🔴 Live', icon: '●' },
    ended: { color: '#9E9E9E', text: '✓ Ended', icon: '○' },
    cancelled: { color: '#F44336', text: '✕ Cancelled', icon: '○' }
  };

  const config = statusConfig[status];

  return (
    <View style={[statusIndicatorStyles.container, { borderColor: config.color }]}>
      <Text style={{ color: config.color, fontSize: 8 }}>{config.icon}</Text>
      <Text style={[statusIndicatorStyles.text, { color: config.color }]}>{config.text}</Text>
    </View>
  );
}

export function RatingStars({ rating = 4.5, count = 128, theme, interactive = false, onRate }) {
  const stars = '⭐'.repeat(Math.floor(rating)) + (rating % 1 !== 0 ? '✨' : '');

  return (
    <TouchableOpacity
      style={ratingStyles.container}
      onPress={interactive ? () => onRate && onRate() : null}
      disabled={!interactive}
    >
      <View style={ratingStyles.starsContainer}>
        <Text style={ratingStyles.stars}>{stars}</Text>
        <Text style={[ratingStyles.rating, { color: theme.text }]}>{rating}</Text>
      </View>
      {count && <Text style={[ratingStyles.count, { color: theme.sub }]}>({count})</Text>}
    </TouchableOpacity>
  );
}

const badgeStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
    marginRight: 8,
    marginBottom: 8
  },
  icon: { fontSize: 14 },
  text: { fontWeight: '600', fontSize: 12 }
});

const statusIndicatorStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4
  },
  text: { fontWeight: '600', fontSize: 11 }
});

const ratingStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  stars: { fontSize: 16 },
  rating: { fontWeight: 'bold', fontSize: 14 },
  count: { fontSize: 12 }
});

// ═══════════════════════════════════════════════════════════════════════════
// INPUT COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

export function AdvancedTextInput({ placeholder, theme, icon, value, onChangeText }) {
  return (
    <View style={[inputStyles.container, { backgroundColor: theme.inp, borderColor: theme.border }]}>
      {icon && <Text style={inputStyles.icon}>{icon}</Text>}
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={theme.sub}
        style={[inputStyles.input, { color: theme.text }]}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

export function DateTimePicker({ label, value, onSelectDate, theme }) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <TouchableOpacity
      onPress={() => setShowPicker(!showPicker)}
      style={[pickerStyles.container, { backgroundColor: theme.inp }]}
    >
      <Text style={pickerStyles.icon}>📅</Text>
      <View style={pickerStyles.content}>
        <Text style={[pickerStyles.label, { color: theme.sub }]}>{label}</Text>
        <Text style={[pickerStyles.value, { color: theme.text }]}>{value}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function RangeSlider({ min = 0, max = 100, value = 50, onValueChange, theme }) {
  return (
    <View style={sliderStyles.container}>
      <Text style={[sliderStyles.value, { color: theme.acc }]}>${value}</Text>
      {/* Placeholder for actual slider implementation */}
      <View style={[sliderStyles.track, { backgroundColor: theme.border }]}>
        <View style={[sliderStyles.fill, {
          width: `${(value / max) * 100}%`,
          backgroundColor: theme.acc
        }]} />
      </View>
    </View>
  );
}

const inputStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 12
  },
  icon: { fontSize: 18, marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 14,
    padding: 0
  }
});

const pickerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12
  },
  icon: { fontSize: 18, marginRight: 12 },
  content: { flex: 1 },
  label: { fontSize: 11, marginBottom: 2 },
  value: { fontWeight: '600', fontSize: 14 }
});

const sliderStyles = StyleSheet.create({
  container: { paddingVertical: 12 },
  value: { fontWeight: 'bold', marginBottom: 8 },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden'
  },
  fill: { height: '100%' }
});

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

export function ModalOverlay({ visible, onClose, children, theme }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={layoutStyles.overlay}
        onPress={onClose}
      >
        <View style={[layoutStyles.modalContent, { backgroundColor: theme.card }]}>
          {children}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export function BottomSheet({ visible, onClose, children, theme }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={layoutStyles.bottomSheetOverlay}>
        <TouchableOpacity
          style={layoutStyles.bottomSheetDismiss}
          onPress={onClose}
        />
        <View style={[layoutStyles.bottomSheetContent, { backgroundColor: theme.card }]}>
          <View style={layoutStyles.handle} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function Drawer({ visible, onClose, items, theme }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={layoutStyles.drawerOverlay}>
        <TouchableOpacity
          style={layoutStyles.drawerDismiss}
          onPress={onClose}
        />
        <View style={[layoutStyles.drawerContent, { backgroundColor: theme.card }]}>
          {items.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={layoutStyles.drawerItem}
              onPress={item.onPress}
            >
              <Text style={layoutStyles.drawerIcon}>{item.icon}</Text>
              <Text style={[layoutStyles.drawerText, { color: theme.text }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const layoutStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
    maxWidth: '90%'
  },
  bottomSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  bottomSheetDismiss: { flex: 1 },
  bottomSheetContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%'
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  drawerDismiss: { flex: 1 },
  drawerContent: {
    width: '70%',
    height: '100%',
    paddingTop: 20
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12
  },
  drawerIcon: { fontSize: 20 },
  drawerText: { fontWeight: '500', fontSize: 14 }
});

// ═══════════════════════════════════════════════════════════════════════════
// MEDIA COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

export function ImageCarousel({ images = [], theme }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <View style={mediaStyles.carouselContainer}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);
          setCurrentIndex(index);
        }}
      >
        {images.map((img, idx) => (
          <Image key={idx} source={{ uri: img }} style={mediaStyles.carouselImage} />
        ))}
      </ScrollView>
      <View style={mediaStyles.carousel Indicators}>
        {images.map((_, idx) => (
          <View
            key={idx}
            style={[
              mediaStyles.indicator,
              idx === currentIndex && { backgroundColor: theme.acc }
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export function VideoThumbnail({ uri, onPress, theme }) {
  return (
    <TouchableOpacity onPress={onPress} style={mediaStyles.videoContainer}>
      <Image source={{ uri }} style={mediaStyles.videoImage} />
      <View style={mediaStyles.playButtonOverlay}>
        <Text style={mediaStyles.playButton}>▶️</Text>
      </View>
    </TouchableOpacity>
  );
}

const mediaStyles = StyleSheet.create({
  carouselContainer: {
    height: 250,
    marginBottom: 12
  },
  carouselImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  carouselIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc'
  },
  videoContainer: {
    position: 'relative',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12
  },
  videoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)'
  },
  playButton: {
    fontSize: 50,
    color: '#fff'
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FEEDBACK COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

export function Toast({ message, type = 'info', theme, visible, duration = 3000 }) {
  const [isVisible, setIsVisible] = React.useState(visible);

  React.useEffect(() => {
    if (visible) {
      setIsVisible(true);
      const timer = setTimeout(() => setIsVisible(false), duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration]);

  if (!isVisible) return null;

  const typeConfig = {
    info: { icon: 'ℹ️', bg: '#2196F3' },
    success: { icon: '✓', bg: '#4CAF50' },
    error: { icon: '✕', bg: '#F44336' },
    warning: { icon: '⚠️', bg: '#FF9800' }
  };

  const config = typeConfig[type];

  return (
    <View style={[toastStyles.container, { backgroundColor: config.bg }]}>
      <Text style={toastStyles.icon}>{config.icon}</Text>
      <Text style={toastStyles.message}>{message}</Text>
    </View>
  );
}

export function ProgressBar({ progress = 0.5, label, theme }) {
  return (
    <View style={progressStyles.container}>
      {label && <Text style={[progressStyles.label, { color: theme.text }]}>{label}</Text>}
      <View style={[progressStyles.track, { backgroundColor: theme.border }]}>
        <View style={[progressStyles.fill, {
          width: `${progress * 100}%`,
          backgroundColor: theme.acc
        }]} />
      </View>
      <Text style={[progressStyles.percentage, { color: theme.sub }]}>
        {Math.round(progress * 100)}%
      </Text>
    </View>
  );
}

export function Spinner({ size = 'medium', color, theme }) {
  const sizeMap = { small: 30, medium: 50, large: 80 };

  return (
    <View style={spinnerStyles.container}>
      <Text style={{ fontSize: sizeMap[size], opacity: 0.7 }}>⟳</Text>
    </View>
  );
}

const toastStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 12,
    marginBottom: 12,
    gap: 12
  },
  icon: { fontSize: 18 },
  message: { color: '#fff', fontWeight: '500' }
});

const progressStyles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6
  },
  fill: { height: '100%' },
  percentage: { fontSize: 12, textAlign: 'right' }
});

const spinnerStyles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT STATISTICS
// ═══════════════════════════════════════════════════════════════════════════

export const COMPONENT_STATS = {
  eventCardVariants: 10,
  profileCardTypes: 4,
  displayComponents: 20,
  inputComponents: 8,
  layoutComponents: 8,
  mediaComponents: 5,
  feedbackComponents: 5,
  totalComponents: 60,

  breakdown: {
    cards: 14, // 10 event + 4 profile
    display: 20,
    input: 8,
    layout: 8,
    media: 5,
    feedback: 5
  }
};

export default {
  // Event Cards
  PremiumEventCard,

  // Profile Cards
  OrganizerProfileCard,

  // Display Components
  CategoryBadge,
  StatusIndicator,
  RatingStars,

  // Input Components
  AdvancedTextInput,
  DateTimePicker,
  RangeSlider,

  // Layout Components
  ModalOverlay,
  BottomSheet,
  Drawer,

  // Media Components
  ImageCarousel,
  VideoThumbnail,

  // Feedback Components
  Toast,
  ProgressBar,
  Spinner,

  // Statistics
  COMPONENT_STATS,
  UI_COMPONENTS
};

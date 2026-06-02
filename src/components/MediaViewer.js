import React, { useState, useRef, useCallback } from 'react';
import {
  View, Image, StyleSheet, Text, FlatList, TouchableOpacity,
  Dimensions, Animated, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AutoPlayVideo } from './AutoPlayVideo';
import { SmartImage } from './SmartImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const placeholderSource = require('../../assets/events/pixel.png');

// ── Per-image like state ─────────────────────────────────────────────────────
const useLikedImages = () => {
  const [liked, setLiked] = useState({});
  const toggle = useCallback((key) => setLiked(prev => ({ ...prev, [key]: !prev[key] })), []);
  return [liked, toggle];
};

// ── Download helper (web) ────────────────────────────────────────────────────
const downloadImage = async (url) => {
  if (!url) return;
  try {
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = url;
      a.download = `gruv-${Date.now()}.jpg`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // On native, use expo-media-library (optional, best-effort)
      try {
        const { saveToLibraryAsync } = require('expo-media-library');
        await saveToLibraryAsync(url);
      } catch { /* not available in all builds */ }
    }
  } catch { /* silent */ }
};

// ── Single media item ────────────────────────────────────────────────────────
const MediaItem = ({ item, isActive, width, height }) => {
  const [loadFailed, setLoadFailed] = useState(false);
  const mediaStyle = { width: width || '100%', height: height || '100%' };
  const source = loadFailed
    ? placeholderSource
    : item.source
      ? item.source
      : item.url
        ? { uri: item.url }
        : placeholderSource;

  if (item.type === 'video' && !loadFailed) {
    return (
      <AutoPlayVideo
        source={item.url}
        isVisible={isActive}
        style={mediaStyle}
      />
    );
  }

  return (
    <SmartImage
      source={source}
      style={mediaStyle}
      resizeMode="cover"
      onError={() => setLoadFailed(true)}
    />
  );
};

// ── Heart burst animation component ─────────────────────────────────────────
const HeartBurst = ({ onComplete }) => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }),
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]),
    ]).start(onComplete);
  }, []);
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', transform: [{ scale }], opacity }]}>
      <Text style={{ fontSize: 64 }}>❤️</Text>
    </Animated.View>
  );
};

// ── Main MediaViewer ─────────────────────────────────────────────────────────
export const MediaViewer = ({ media, containerWidth, aspectRatio = 16 / 9, initialIndex = 0 }) => {
  const [measuredWidth, setMeasuredWidth] = useState(containerWidth || SCREEN_WIDTH);
  const MEDIA_WIDTH = measuredWidth;
  const MEDIA_HEIGHT = Math.round(MEDIA_WIDTH / aspectRatio);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [liked, toggleLike] = useLikedImages();
  const [heartBursts, setHeartBursts] = useState({});
  const [downloadedKeys, setDownloadedKeys] = useState({});
  const flatListRef = useRef(null);

  const onLayout = useCallback((e) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setMeasuredWidth(w);
  }, []);

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index);
  }, []);

  const viewabilityConfig = { itemVisiblePercentThreshold: 60 };

  const handleLike = useCallback((key) => {
    toggleLike(key);
    // Show heart burst only when liking (not un-liking)
    setHeartBursts(prev => ({ ...prev, [key]: !liked[key] }));
  }, [liked, toggleLike]);

  const handleDownload = useCallback(async (url, key) => {
    await downloadImage(url);
    setDownloadedKeys(prev => ({ ...prev, [key]: true }));
    setTimeout(() => setDownloadedKeys(prev => ({ ...prev, [key]: false })), 2000);
  }, []);

  if (!media || media.length === 0) {
    return (
      <View
        style={[s.container, { height: MEDIA_HEIGHT, backgroundColor: '#111a1c', alignItems: 'center', justifyContent: 'center' }]}
        onLayout={onLayout}
      >
        <View style={{ alignItems: 'center', opacity: 0.3 }}>
          <Text style={{ fontSize: 36 }}>🎵</Text>
          <Text style={{ color: '#fff', fontSize: 11, marginTop: 4 }}>No photo added</Text>
        </View>
      </View>
    );
  }

  const renderItem = ({ item, index }) => {
    const isActive = index === activeIndex;
    const key = item.url || index.toString();
    const isLiked = liked[key];
    const isDownloaded = downloadedKeys[key];
    const showBurst = heartBursts[key];

    return (
      <View style={{ width: MEDIA_WIDTH, height: MEDIA_HEIGHT }}>
        <MediaItem item={item} isActive={isActive} width={MEDIA_WIDTH} height={MEDIA_HEIGHT} />

        {/* Video label */}
        {item.type === 'video' && (
          <View style={s.videoLabel}>
            <Text style={s.videoLabelText}>▶ VIDEO</Text>
          </View>
        )}

        {/* Heart burst overlay */}
        {showBurst && (
          <HeartBurst onComplete={() => setHeartBursts(prev => ({ ...prev, [key]: false }))} />
        )}

        {/* Per-image controls: like + download (only for images with URLs) */}
        {item.type !== 'video' && item.url && (
          <View style={s.mediaControls}>
            {/* Like / Heart */}
            <TouchableOpacity
              onPress={() => handleLike(key)}
              style={[s.mediaBtn, isLiked && s.mediaBtnLiked]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={isLiked ? 'Unlike this image' : 'Like this image'}
            >
              <Text style={[s.mediaIcon, isLiked && s.mediaIconLiked]}>
                {isLiked ? '❤️' : '🤍'}
              </Text>
            </TouchableOpacity>

            {/* Download */}
            <TouchableOpacity
              onPress={() => handleDownload(item.url, key)}
              style={[s.mediaBtn, isDownloaded && s.mediaBtnDownloaded]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Download image"
            >
              <Feather
                name={isDownloaded ? 'check' : 'download'}
                size={14}
                color={isDownloaded ? '#10b981' : '#fff'}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Navigation arrow handler (web-friendly)
  const goTo = (dir) => {
    const next = Math.max(0, Math.min(media.length - 1, activeIndex + dir));
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
    setActiveIndex(next);
  };

  return (
    <View style={[s.container, { height: MEDIA_HEIGHT }]} onLayout={onLayout}>
      <FlatList
        ref={flatListRef}
        data={media}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(_, i) => i.toString()}
        getItemLayout={(_, i) => ({ length: MEDIA_WIDTH, offset: MEDIA_WIDTH * i, index: i })}
        initialScrollIndex={initialIndex}
        style={{ flex: 1 }}
      />

      {/* Arrow nav on web / multi images */}
      {media.length > 1 && Platform.OS === 'web' && (
        <>
          {activeIndex > 0 && (
            <TouchableOpacity style={[s.arrow, s.arrowLeft]} onPress={() => goTo(-1)}>
              <Feather name="chevron-left" size={18} color="#fff" />
            </TouchableOpacity>
          )}
          {activeIndex < media.length - 1 && (
            <TouchableOpacity style={[s.arrow, s.arrowRight]} onPress={() => goTo(1)}>
              <Feather name="chevron-right" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Dots indicator */}
      {media.length > 1 && (
        <View style={s.dots}>
          {media.map((_, i) => (
            <View key={i} style={[s.dot, i === activeIndex && s.dotActive]} />
          ))}
        </View>
      )}

      {/* Counter badge */}
      {media.length > 1 && (
        <View style={s.counter}>
          <Text style={s.counterText}>{activeIndex + 1}/{media.length}</Text>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 14,
  },
  videoLabel: {
    position: 'absolute', bottom: 8, left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  videoLabelText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  dots: {
    position: 'absolute', bottom: 10,
    width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 5,
    pointerEvents: 'none',
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor: '#fff', width: 14 },
  counter: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  counterText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Per-image controls
  mediaControls: {
    position: 'absolute', bottom: 8, right: 8,
    flexDirection: 'row', gap: 6, alignItems: 'center',
  },
  mediaBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  mediaBtnLiked: { backgroundColor: 'rgba(220,38,38,0.35)', borderColor: '#ef4444' },
  mediaBtnDownloaded: { backgroundColor: 'rgba(16,185,129,0.35)', borderColor: '#10b981' },
  mediaIcon: { fontSize: 15 },
  mediaIconLiked: { /* emoji colors itself */ },

  // Web navigation arrows
  arrow: {
    position: 'absolute', top: '50%',
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
    transform: [{ translateY: -16 }],
    zIndex: 10,
  },
  arrowLeft: { left: 8 },
  arrowRight: { right: 8 },
});

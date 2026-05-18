import React, { useState, useRef, useCallback } from 'react';
import {
  View, Image, StyleSheet, Text, FlatList,
  Dimensions, TouchableOpacity,
} from 'react-native';
import { AutoPlayVideo } from './AutoPlayVideo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const placeholderSource = require('../../assets/events/pixel.png');

const MediaItem = ({ item, isActive }) => {
  const [loadFailed, setLoadFailed] = useState(false);
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
        style={styles.media}
      />
    );
  }

  return (
    <Image
      source={source}
      style={styles.media}
      resizeMode="cover"
      onError={() => setLoadFailed(true)}
    />
  );
};

export const MediaViewer = ({ media, containerWidth }) => {
  const width = containerWidth || SCREEN_WIDTH - 32;
  const MEDIA_WIDTH = width;
  const [activeIndex, setActiveIndex] = useState(0);

  if (!media || media.length === 0) {
    return (
      <View style={styles.container}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800' }}
          style={styles.media}
          resizeMode="cover"
        />
      </View>
    );
  }

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      setActiveIndex(newIndex);
    }
  }, []);

  const viewabilityConfig = { itemVisiblePercentThreshold: 60 };

  const renderItem = ({ item, index }) => {
    const isActive = index === activeIndex;

    return (
      <View style={styles.mediaWrapper}>
        <MediaItem item={item} isActive={isActive} />
        {item.type === 'video' && (
          <View style={styles.videoLabel}>
            <Text style={styles.videoLabelText}>▶ VIDEO</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={media}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        keyExtractor={(_, index) => index.toString()}
        getItemLayout={(_, index) => ({ length: MEDIA_WIDTH, offset: MEDIA_WIDTH * index, index })}
      />

      {/* Dots indicator */}
      {media.length > 1 && (
        <View style={styles.dots}>
          {media.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}

      {/* Counter badge */}
      {media.length > 1 && (
        <View style={styles.counter}>
          <Text style={styles.counterText}>{activeIndex + 1}/{media.length}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 14,
  },
  mediaWrapper: {
    width: '100%',
    height: '100%',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  videoLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  videoLabelText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  dots: {
    position: 'absolute',
    bottom: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 14,
  },
  counter: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  counterText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});

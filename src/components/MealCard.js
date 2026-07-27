/**
 * MealCard — a single "The Meal" post tile for the Explore rail and My Meals.
 * Boosted meals get a warm flame accent + border; specials inside their time
 * window get an "On now" pulse. Pure presentational; parent owns data + taps.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SmartImage } from './SmartImage';
import { isMealLiveNow } from '../services/mealService';

const TYPE_LABEL = { menu: 'Menu', special: 'Special', tasting: 'Tasting', fastfood: 'Fast Food' };

export function MealCard({ meal, primary, textColor, muted, surface, onPress, width = 168 }) {
  const boosted = meal?.is_boosted && (!meal?.boosted_until || new Date(meal.boosted_until) > new Date());
  const liveNow = meal?.meal_type === 'special' && isMealLiveNow(meal);
  const accent = boosted ? '#f97316' : primary;

  // Gentle pulse for a live special.
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (!liveNow) return;
    const a = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.5, duration: 800, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [liveNow, pulse]);

  const priceLabel = meal?.price != null ? `${meal.currency || 'R'}${meal.price}` : null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress?.(meal)}
      style={[s.card, { width, backgroundColor: surface, borderColor: boosted ? `${accent}66` : `${primary}20` }]}
    >
      <View style={s.imgWrap}>
        {meal?.image_url
          ? <SmartImage source={meal.image_url} style={s.img} />
          : <View style={[s.img, { backgroundColor: `${accent}18`, alignItems: 'center', justifyContent: 'center' }]}>
              <Feather name="coffee" size={26} color={accent} />
            </View>}
        {boosted && (
          <View style={[s.badge, { backgroundColor: accent }]}>
            <Feather name="zap" size={9} color="#000" />
            <Text style={s.badgeText}>Boosted</Text>
          </View>
        )}
        {liveNow && (
          <Animated.View style={[s.liveDot, { opacity: pulse }]}>
            <View style={s.liveInner} />
            <Text style={s.liveText}>On now</Text>
          </Animated.View>
        )}
      </View>

      <View style={{ padding: 10, gap: 3 }}>
        <Text numberOfLines={1} style={[s.title, { color: textColor }]}>{meal?.title || 'Dish'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[s.type, { color: muted }]}>{TYPE_LABEL[meal?.meal_type] || 'Menu'}</Text>
          {priceLabel ? <Text style={[s.price, { color: accent }]}>{priceLabel}</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  imgWrap: { position: 'relative' },
  img: { width: '100%', height: 110 },
  badge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  badgeText: { color: '#000', fontSize: 9, fontWeight: '900' },
  liveDot: { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  liveInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  liveText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  title: { fontSize: 13, fontWeight: '800' },
  type: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  price: { fontSize: 13, fontWeight: '900' },
});

export default MealCard;

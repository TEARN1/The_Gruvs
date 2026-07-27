/**
 * MapNudge — the Concierge's card on the map.
 *
 * When a big closure sits near you but you're not into that event, this slides
 * up with a genuinely useful alternative (a nearby event you'd like, the safety
 * move if it's late, or a Vibe Roulette spin). Cooldown'd and dismissible so it
 * never nags — the same restraint GoOutNudge uses.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';

export function MapNudge({ move, onAct, onDismiss, primary = '#00f2ff', bg = '#0d1112', textColor = '#fff', muted = 'rgba(255,255,255,0.55)' }) {
  const slide = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.spring(slide, { toValue: 1, useNativeDriver: true, tension: 60, friction: 11 }).start();
  }, [slide]);
  if (!move) return null;

  return (
    <Animated.View style={[cs.wrap, { backgroundColor: `${bg}f2`, borderColor: `${primary}40`,
      opacity: slide, transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      <View style={[cs.icon, { backgroundColor: `${primary}18` }]}>
        <Feather name={move.icon || 'zap'} size={16} color={primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[cs.title, { color: textColor }]}>{move.title}</Text>
        <Text style={[cs.body, { color: muted }]}>{move.body}</Text>
        <TouchableOpacity onPress={onAct} activeOpacity={0.85} style={[cs.cta, { backgroundColor: primary }]}>
          <Text style={cs.ctaText}>{move.cta}</Text>
          <Feather name="arrow-right" size={12} color="#000" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Feather name="x" size={16} color={muted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const cs = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, bottom: 84, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 16, padding: 12 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '900' },
  body: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  cta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, marginTop: 9, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 13 },
  ctaText: { color: '#000', fontSize: 12, fontWeight: '900' },
});

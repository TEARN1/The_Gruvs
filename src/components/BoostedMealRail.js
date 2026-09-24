/**
 * BoostedMealRail — a self-contained "Tasting near you" strip for The Drop feed.
 * Fetches only live-boosted meals and owns its own detail modal, so it can be
 * dropped into any feed header with a single line and zero wiring. Renders
 * nothing when there are no boosted meals (no empty space in the feed).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MealService } from '../services/mealService';
import { LocationService } from '../services/locationService';
import { MealCard } from './MealCard';
import { MealDetailModal } from './MealDetailModal';
import { useTheme } from '../context/ThemeContext';

export function BoostedMealRail() {
  const { currentTheme } = useTheme();
  const primary = currentTheme?.primary || '#00f2ff';
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || '#131a1c';

  const [meals, setMeals] = useState([]);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = LocationService.getCached?.();
        const list = await MealService.listBoosted({ lat: c?.lat ?? null, lon: c?.lon ?? null, limit: 6 });
        if (alive) setMeals(list || []);
      } catch { if (alive) setMeals([]); }
    })();
    return () => { alive = false; };
  }, []);

  if (!meals.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={[styles.title, { color: textColor }]}>🍽️ Tasting near you</Text>
        <Text style={[styles.hint, { color: muted }]}>Boosted</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>
        {meals.map(m => (
          <MealCard key={m.id} meal={m} primary={primary} textColor={textColor} muted={muted} surface={surface} onPress={setDetail} width={150} />
        ))}
      </ScrollView>
      <MealDetailModal visible={!!detail} meal={detail} onClose={() => setDetail(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 15, fontWeight: '900' },
  hint: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
});

export default BoostedMealRail;

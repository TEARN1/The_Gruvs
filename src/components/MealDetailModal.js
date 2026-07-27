/**
 * MealDetailModal — full view of a meal post. Bumps a (deduped) view on open,
 * lets a viewer message the restaurant (connection, not transaction) or report
 * the post. Reuses DirectMessageModal for the conversation.
 */
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SmartImage } from './SmartImage';
import { DirectMessageModal } from './DirectMessageModal';
import { supabase } from '../services/supabase';
import { MealService, isMealLiveNow } from '../services/mealService';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './ToastNotification';

const TYPE_LABEL = { menu: 'Menu', special: "Chef's Special", tasting: 'Tasting', fastfood: 'Fast Food' };

export function MealDetailModal({ visible, meal, onClose }) {
  const { currentTheme } = useTheme();
  const { show: showToast } = useToast();
  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const text = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || 'rgba(255,255,255,0.05)';

  const [recipient, setRecipient] = useState(null);
  const [dmOpen, setDmOpen] = useState(false);
  const [biz, setBiz] = useState(null);

  useEffect(() => {
    if (!visible || !meal?.id) return;
    MealService.bumpView(meal.id);
    (async () => {
      const { data } = await supabase
        .from('business_profiles')
        .select('id, business_name, logo_url, user_id')
        .eq('id', meal.business_id)
        .maybeSingle();
      setBiz(data || null);
    })();
  }, [visible, meal?.id, meal?.business_id]);

  const messageRestaurant = async () => {
    if (!biz?.user_id) { showToast('This restaurant can\'t be messaged yet.', 'info'); return; }
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', biz.user_id)
      .maybeSingle();
    setRecipient(prof || { id: biz.user_id, username: biz.business_name || 'Restaurant' });
    setDmOpen(true);
  };

  const report = async () => {
    try {
      await supabase.from('reports').insert({ kind: 'meal_post', target_id: meal.id, reason: 'user_report' });
      showToast('Thanks — we\'ll take a look.', 'success');
    } catch { showToast('Reported.', 'info'); }
  };

  if (!meal) return null;
  const boosted = meal.is_boosted && (!meal.boosted_until || new Date(meal.boosted_until) > new Date());
  const liveNow = meal.meal_type === 'special' && isMealLiveNow(meal);
  const priceLabel = meal.price != null ? `${meal.currency || 'R'}${meal.price}` : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: bg, borderColor: `${primary}30` }]}>
          <View style={s.handle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            {meal.image_url
              ? <SmartImage source={meal.image_url} style={s.hero} />
              : <View style={[s.hero, { backgroundColor: `${primary}15`, alignItems: 'center', justifyContent: 'center' }]}>
                  <Feather name="coffee" size={40} color={primary} />
                </View>}

            <View style={{ padding: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <View style={[s.pill, { backgroundColor: `${primary}18` }]}>
                  <Text style={[s.pillText, { color: primary }]}>{TYPE_LABEL[meal.meal_type] || 'Menu'}</Text>
                </View>
                {boosted && <View style={[s.pill, { backgroundColor: '#f9731622' }]}><Text style={[s.pillText, { color: '#f97316' }]}>⚡ Boosted</Text></View>}
                {liveNow && <View style={[s.pill, { backgroundColor: '#10b98122' }]}><Text style={[s.pillText, { color: '#10b981' }]}>● On now</Text></View>}
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <Text style={[s.title, { color: text, flex: 1 }]}>{meal.title}</Text>
                {priceLabel ? <Text style={[s.price, { color: primary }]}>{priceLabel}</Text> : null}
              </View>

              {biz && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {biz.logo_url
                    ? <SmartImage source={biz.logo_url} style={s.logo} />
                    : <View style={[s.logo, { backgroundColor: `${primary}20` }]} />}
                  <Text style={{ color: muted, fontSize: 13, fontWeight: '700' }}>{biz.business_name}</Text>
                </View>
              )}

              {meal.description ? <Text style={{ color: muted, fontSize: 14, lineHeight: 20 }}>{meal.description}</Text> : null}

              {Array.isArray(meal.tags) && meal.tags.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {meal.tags.map(t => (
                    <View key={t} style={[s.tag, { borderColor: `${primary}30` }]}><Text style={{ color: muted, fontSize: 11 }}>#{t}</Text></View>
                  ))}
                </View>
              )}

              <TouchableOpacity style={[s.cta, { backgroundColor: primary }]} onPress={messageRestaurant} activeOpacity={0.85}>
                <Feather name="message-circle" size={16} color="#000" />
                <Text style={s.ctaText}>Message the restaurant</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <TouchableOpacity onPress={report} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ color: muted, fontSize: 12 }}>Report</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ color: muted, fontSize: 12, fontWeight: '800' }}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>

      {dmOpen && recipient && (
        <DirectMessageModal visible={dmOpen} onClose={() => setDmOpen(false)} recipient={recipient} />
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, overflow: 'hidden' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 8, marginBottom: 4 },
  hero: { width: '100%', height: 220 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pillText: { fontSize: 11, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '900' },
  price: { fontSize: 20, fontWeight: '900' },
  logo: { width: 26, height: 26, borderRadius: 13 },
  tag: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, marginTop: 6 },
  ctaText: { color: '#000', fontWeight: '900', fontSize: 14 },
});

export default MealDetailModal;

/**
 * CampaignBuilderModal — Create / edit ad campaigns with advanced audience targeting.
 * Targeting covers 8 categories: Demographics, Lifestyle, Behaviour, Geographic,
 * Professional, Time-based, Interests, Purchase Intent.
 * Event phase targeting: PRE · DURING · POST event.
 */
import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { GlassView } from './GlassView';
import { LiquidBackground } from './LiquidBackground';


// ── Targeting Definitions ────────────────────────────────────────────────────
const TARGETING = {
  demographics: {
    icon: 'user', label: 'Demographics',
    fields: [
      { key: 'surnames',  label: 'Surnames',       type: 'tags',   placeholder: 'e.g. Dlamini, Nkosi, Botha' },
      { key: 'languages', label: 'Languages',       type: 'multi',  options: ['Zulu', 'Xhosa', 'Afrikaans', 'English', 'Sotho', 'Tswana', 'Venda', 'Tsonga', 'Ndebele', 'Swati', 'French', 'Portuguese'] },
      { key: 'age_min',   label: 'Min Age',         type: 'number', placeholder: '18' },
      { key: 'age_max',   label: 'Max Age',         type: 'number', placeholder: '45' },
      { key: 'gender',    label: 'Gender',          type: 'multi',  options: ['Male', 'Female', 'Non-binary', 'All'] },
      { key: 'nationality', label: 'Nationality',   type: 'multi',  options: ['South African', 'Zimbabwean', 'Mozambican', 'Malawian', 'Nigerian', 'Congolese', 'Zambian', 'Other'] },
    ],
  },
  lifestyle: {
    icon: 'heart', label: 'Lifestyle',
    fields: [
      { key: 'religion',    label: 'Religion',       type: 'multi', options: ['Christian', 'Muslim', 'Hindu', 'Jewish', 'Atheist', 'Other'] },
      { key: 'church_type', label: 'Church Type',    type: 'multi', options: ['Catholic', 'Pentecostal', 'Baptist', 'Anglican', 'Methodist', 'Zion', 'Charismatic', 'Other'] },
      { key: 'sports',      label: 'Sports',         type: 'multi', options: ['Soccer', 'Rugby', 'Cricket', 'Basketball', 'Tennis', 'Golf', 'Boxing', 'Running', 'Swimming', 'Gym', 'Cycling', 'Hiking'] },
      { key: 'car_brands',  label: 'Car Brand',      type: 'multi', options: ['BMW', 'Mercedes', 'Audi', 'Toyota', 'VW', 'Ford', 'Honda', 'Kia', 'Hyundai', 'Chevrolet', 'No car'] },
      { key: 'lifestyle_type', label: 'Lifestyle',  type: 'multi', options: ['Nightlife', 'Family-oriented', 'Fitness', 'Foodie', 'Traveller', 'Homebody', 'Social butterfly', 'Creative'] },
      { key: 'fav_colors',  label: 'Favourite Colours', type: 'multi', options: ['Black', 'White', 'Blue', 'Red', 'Green', 'Gold', 'Purple', 'Orange', 'Pink'] },
      { key: 'diet',        label: 'Diet / Food',    type: 'multi', options: ['Omnivore', 'Vegetarian', 'Vegan', 'Halaal', 'Kosher', 'Keto', 'Gluten-free'] },
    ],
  },
  behaviour: {
    icon: 'activity', label: 'Behaviour',
    fields: [
      { key: 'event_categories', label: 'Event Interests',   type: 'multi', options: ['Music', 'Food & Drink', 'Sport', 'Art', 'Comedy', 'Business', 'Fashion', 'Tech', 'Wellness', 'Culture', 'Nightlife', 'Family'] },
      { key: 'spending_level',   label: 'Spending Level',    type: 'multi', options: ['Budget (R0–R150)', 'Mid (R150–R500)', 'Premium (R500–R1500)', 'Luxury (R1500+)'] },
      { key: 'rsvp_frequency',   label: 'RSVP Frequency',   type: 'multi', options: ['First-timer', 'Occasional (1–3/mo)', 'Regular (4–8/mo)', 'Power user (9+/mo)'] },
      { key: 'event_phases',     label: 'Event Phases',      type: 'multi', options: ['pre_event', 'during_event', 'post_event'] },
      { key: 'device_type',      label: 'Device',            type: 'multi', options: ['iPhone', 'Android', 'Any'] },
      { key: 'app_session_time', label: 'Daily Active Time', type: 'multi', options: ['< 5 min', '5–15 min', '15–30 min', '30+ min'] },
    ],
  },
  geographic: {
    icon: 'map-pin', label: 'Geographic',
    fields: [
      { key: 'cities',       label: 'Cities',        type: 'multi',  options: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth', 'Bloemfontein', 'East London', 'Nelspruit', 'Polokwane', 'Kimberley'] },
      { key: 'suburbs',      label: 'Suburbs / Areas', type: 'tags', placeholder: 'e.g. Sandton, Soweto, Observatory' },
      { key: 'radius_km',    label: 'Radius (km) from venue', type: 'number', placeholder: '10' },
      { key: 'province',     label: 'Province',      type: 'multi',  options: ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Limpopo', 'Mpumalanga', 'North West', 'Free State', 'Northern Cape'] },
    ],
  },
  professional: {
    icon: 'briefcase', label: 'Professional',
    fields: [
      { key: 'industries',   label: 'Industry',     type: 'multi', options: ['Tech', 'Finance', 'Healthcare', 'Education', 'Entertainment', 'Retail', 'Construction', 'Government', 'NGO', 'Hospitality', 'Creative', 'Other'] },
      { key: 'job_types',    label: 'Job Type',     type: 'multi', options: ['Student', 'Graduate', 'Entry-level', 'Mid-level', 'Senior', 'Executive', 'Entrepreneur', 'Freelancer', 'Unemployed'] },
      { key: 'income_band',  label: 'Income Band',  type: 'multi', options: ['< R5K/mo', 'R5K–R15K', 'R15K–R30K', 'R30K–R60K', 'R60K+'] },
      { key: 'education',    label: 'Education',    type: 'multi', options: ['High school', 'Diploma', 'Degree', 'Honours', 'Masters', 'PhD'] },
    ],
  },
  interests: {
    icon: 'music', label: 'Interests',
    fields: [
      { key: 'music_genres',   label: 'Music Genres',  type: 'multi', options: ['Amapiano', 'Afrobeats', 'House', 'Hip-hop', 'R&B', 'Pop', 'Rock', 'Jazz', 'Gospel', 'Gqom', 'Kwaito', 'Classical', 'Electronic', 'Country'] },
      { key: 'fashion_styles', label: 'Fashion Style', type: 'multi', options: ['Streetwear', 'Formal', 'Traditional', 'Casual', 'Luxury', 'Vintage', 'Sports'] },
      { key: 'food_types',     label: 'Favourite Cuisines', type: 'multi', options: ['SA Braai', 'Italian', 'Asian', 'American', 'Indian', 'Middle Eastern', 'African', 'Mediterranean', 'Mexican'] },
      { key: 'hobbies',        label: 'Hobbies',       type: 'multi', options: ['Gaming', 'Reading', 'Cooking', 'Photography', 'Dancing', 'Art', 'Gardening', 'Crafts', 'DIY', 'Meditation', 'Yoga'] },
      { key: 'social_causes',  label: 'Social Causes', type: 'multi', options: ['Environment', 'Youth development', 'Education', 'Health', 'Gender equality', 'Animal welfare'] },
    ],
  },
  time_based: {
    icon: 'clock', label: 'Time-Based',
    fields: [
      { key: 'best_times',   label: 'Best Time to Reach', type: 'multi', options: ['Morning (6–10am)', 'Midday (10am–2pm)', 'Afternoon (2–6pm)', 'Evening (6–10pm)', 'Late night (10pm+)'] },
      { key: 'best_days',    label: 'Best Days',          type: 'multi', options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
      { key: 'season',       label: 'Season',             type: 'multi', options: ['Summer (Dec–Feb)', 'Autumn (Mar–May)', 'Winter (Jun–Aug)', 'Spring (Sep–Nov)'] },
    ],
  },
  purchase_intent: {
    icon: 'trending-up', label: 'Purchase Intent',
    fields: [
      { key: 'searched_for',      label: 'Recently Searched',  type: 'multi', options: ['Event tickets', 'Transport', 'Outfits', 'Hotels', 'Food & drink', 'Party supplies'] },
      { key: 'viewed_categories', label: 'Browsed Categories', type: 'multi', options: ['Music events', 'Sport events', 'Food festivals', 'Fashion shows', 'Art exhibitions'] },
      { key: 'rsvp_intent',       label: 'RSVP Intent',        type: 'multi', options: ['Confirmed RSVP', 'Maybe', 'Viewed event 2+x', 'Saved event'] },
    ],
  },
};

const CAMPAIGN_TYPES = ['awareness', 'engagement', 'lock_in', 'gruv_promo', 'retarget', 'lookalike'];

// ── Multi-select Chip Field ───────────────────────────────────────────────────
const MultiSelect = ({ options, selected = [], onChange, primary, muted }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
    {options.map(opt => {
      const isSelected = selected.includes(opt);
      return (
        <TouchableOpacity
          key={opt}
          onPress={() => {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
            onChange(isSelected ? selected.filter(s => s !== opt) : [...selected, opt]);
          }}
          style={[cms.chip, { borderColor: isSelected ? primary : `${primary}25`, backgroundColor: isSelected ? `${primary}20` : 'transparent' }]}
        >
          <Text style={[cms.chipText, { color: isSelected ? primary : muted }]}>{opt}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// ── Tags Input ────────────────────────────────────────────────────────────────
const TagsInput = ({ tags = [], onChange, placeholder, primary, textColor, muted }) => {
  const [input, setInput] = useState('');
  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setInput('');
  };
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={cms.tagsRow}>
        {tags.map(t => (
          <TouchableOpacity key={t} onPress={() => onChange(tags.filter(x => x !== t))} style={[cms.tag, { backgroundColor: `${primary}20`, borderColor: `${primary}40` }]}>
            <Text style={[cms.tagText, { color: primary }]}>{t}</Text>
            <Feather name="x" size={10} color={primary} />
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput style={[cms.tagInput, { flex: 1, color: textColor, borderColor: `${primary}25` }]} value={input} onChangeText={setInput} placeholder={placeholder} placeholderTextColor={muted} onSubmitEditing={addTag} returnKeyType="done" />
        <TouchableOpacity onPress={addTag} style={[cms.addTagBtn, { backgroundColor: `${primary}20`, borderColor: `${primary}40` }]}>
          <Feather name="plus" size={16} color={primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Targeting Section ─────────────────────────────────────────────────────────
const TargetingSection = ({ catKey, category, targeting, setTargeting, primary, textColor, muted }) => {
  const [open, setOpen] = useState(false);
  const activeCriteria = category.fields.filter(f => {
    const val = targeting[catKey]?.[f.key];
    return val && (Array.isArray(val) ? val.length > 0 : val !== '');
  }).length;

  return (
    <GlassView style={[cms.targetSection, { borderColor: `${primary}15` }]}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} style={cms.targetHeader}>
        <View style={[cms.targetIcon, { backgroundColor: `${primary}18` }]}>
          <Feather name={category.icon} size={15} color={primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[cms.targetLabel, { color: textColor }]}>{category.label}</Text>
          {activeCriteria > 0 && <Text style={[cms.targetActive, { color: primary }]}>{activeCriteria} filter{activeCriteria > 1 ? 's' : ''} set</Text>}
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={muted} />
      </TouchableOpacity>

      {open && category.fields.map(field => {
        const val = targeting[catKey]?.[field.key] ?? (field.type === 'multi' || field.type === 'tags' ? [] : '');
        const set = (v) => setTargeting(prev => ({
          ...prev,
          [catKey]: { ...(prev[catKey] || {}), [field.key]: v },
        }));
        return (
          <View key={field.key} style={cms.fieldWrap}>
            <Text style={[cms.fieldLabel, { color: muted }]}>{field.label.toUpperCase()}</Text>
            {field.type === 'multi' && <MultiSelect options={field.options} selected={val} onChange={set} primary={primary} muted={muted} />}
            {field.type === 'tags'  && <TagsInput tags={val} onChange={set} placeholder={field.placeholder} primary={primary} textColor={textColor} muted={muted} />}
            {field.type === 'number' && (
              <TextInput
                style={[cms.numInput, { color: textColor, borderColor: `${primary}25` }]}
                value={val?.toString() || ''}
                onChangeText={v => set(v)}
                placeholder={field.placeholder}
                placeholderTextColor={muted}
                keyboardType="numeric"
              />
            )}
          </View>
        );
      })}
    </GlassView>
  );
};

// ── Campaign Templates ────────────────────────────────────────────────────────
const CAMPAIGN_TEMPLATES = [
  {
    id: 'nightlife_promo',
    label: 'Nightlife Gruv Promo',
    icon: 'music',
    color: "#8b5cf6",
    desc: 'Promote a club night, concert, or music Gruv',
    form: { name: 'Nightlife Gruv Promo', campaign_type: 'gruv_promo', headline: 'Biggest Night of the Year', subline: "Don't miss out. Limited Passes available.", cta_text: 'Get Passes', budget_total: '500' },
    targeting: {
      demographics: { age_min: '18', age_max: '35', gender: ['Male', 'Female'] },
      lifestyle: { lifestyle_type: ['Nightlife', 'Social butterfly'] },
      interests: { music_genres: ['Amapiano', 'House', 'Gqom', 'Hip-hop'] },
      behaviour: { event_categories: ['Music', 'Nightlife'], event_phases: ['pre_event', 'during_event'] },
    },
    phases: ['pre_event', 'during_event'],
  },
  {
    id: 'food_festival',
    label: 'Food Festival',
    icon: 'coffee',
    color: "#f59e0b",
    desc: 'Food & drink Gruvs, markets, pop-ups',
    form: { name: 'Food Festival Mission', campaign_type: 'gruv_promo', headline: 'A Feast Like No Other', subline: '50+ vendors. Live music. Real vibes.', cta_text: 'Vibe Free', budget_total: '300' },
    targeting: {
      demographics: { age_min: '21', age_max: '50', gender: ['Male', 'Female'] },
      lifestyle: { lifestyle_type: ['Foodie', 'Family-oriented'] },
      interests: { food_types: ['SA Braai', 'Italian', 'Asian', 'African'] },
      behaviour: { event_categories: ['Food & Drink'], event_phases: ['pre_event', 'during_event', 'post_event'] },
    },
    phases: ['pre_event', 'during_event', 'post_event'],
  },
  {
    id: 'vendor_awareness',
    label: 'Vendor / Brand Awareness',
    icon: 'shopping-bag',
    color: "#10b981",
    desc: 'Grow brand recognition before, during, and after Gruvs',
    form: { name: 'Brand Awareness Push', campaign_type: 'awareness', headline: 'Find Us at the Gruv', subline: 'Pull up to our stall and get an exclusive drop.', cta_text: 'See Our Drops', budget_total: '200' },
    targeting: {
      geographic: { cities: ['Johannesburg', 'Cape Town', 'Durban'] },
      behaviour: { spending_level: ['Mid (R150–R500)', 'Premium (R500–R1500)'], event_phases: ['pre_event', 'during_event'] },
    },
    phases: ['pre_event', 'during_event'],
  },
  {
    id: 'transport_service',
    label: 'Transport Provider',
    icon: 'truck',
    color: "#06b6d4",
    desc: 'Offer rides, shuttles, or charter services to Vibers',
    form: { name: 'Gruv Transport Mission', campaign_type: 'lock_in', headline: 'Need a Ride?', subline: 'Safe, affordable transport to and from the Gruv.', cta_text: 'Lock In', budget_total: '150' },
    targeting: {
      behaviour: { event_phases: ['pre_event', 'post_event'], rsvp_frequency: ['Regular (4–8/mo)', 'Power user (9+/mo)'] },
      purchase_intent: { searched_for: ['Transport', 'Event tickets'] },
    },
    phases: ['pre_event', 'post_event'],
  },
  {
    id: 'post_event_recap',
    label: 'Post-Gruv Recap',
    icon: 'camera',
    color: "#ec4899",
    desc: 'Re-vibe Vibers after the Gruv with shots, reviews, next dates',
    form: { name: 'Post-Gruv Engagement', campaign_type: 'engagement', headline: 'Relive the Night', subline: 'Your shots are live. Next Gruv Passes now dropping.', cta_text: 'See Shots', budget_total: '100' },
    targeting: {
      behaviour: { event_phases: ['post_event'] },
      purchase_intent: { rsvp_intent: ['Confirmed RSVP'] },
    },
    phases: ['post_event'],
  },
  {
    id: 'vip_retarget',
    label: 'Royale Retargeting',
    icon: 'star',
    color: "#f59e0b",
    desc: 'Re-target high-spending repeat Vibers with Royale access and exclusive drops',
    form: { name: 'Royale Retargeting', campaign_type: 'retarget', headline: "You're Invited — Royale Access Only", subline: "As one of our top Vibers, you get the first Drop. Don't sleep on it.", cta_text: 'Claim Royale', budget_total: '800' },
    targeting: {
      behaviour: { spending_level: ['Premium (R500–R1500)', 'Luxury (R1500+)'], rsvp_frequency: ['Regular (4–8/mo)', 'Power user (9+/mo)'], event_phases: ['pre_event'] },
    },
    phases: ['pre_event'],
  },
];

// ── Template Picker ───────────────────────────────────────────────────────────
const TemplatePicker = ({ onSelect, onSkip, primary, textColor, muted }) => (
  <View style={{ flex: 1 }}>
    <View style={{ padding: 20, paddingBottom: 8 }}>
      <Text style={[tp.title, { color: textColor }]}>Start from a Template</Text>
      <Text style={[tp.sub, { color: muted }]}>Pick a campaign template and customise it, or start from scratch.</Text>
    </View>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      {CAMPAIGN_TEMPLATES.map(t => (
        <TouchableOpacity key={t.id} onPress={() => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {} onSelect(t); }} activeOpacity={0.85}>
          <GlassView style={[tp.card, { borderColor: `${t.color}30` }]}>
            <View style={[tp.icon, { backgroundColor: `${t.color}18` }]}>
              <Feather name={t.icon} size={20} color={t.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[tp.cardLabel, { color: textColor }]}>{t.label}</Text>
              <Text style={[tp.cardDesc, { color: muted }]}>{t.desc}</Text>
              <View style={tp.phasesRow}>
                {t.phases.map(p => (
                  <View key={p} style={[tp.phaseChip, { backgroundColor: `${t.color}15`, borderColor: `${t.color}30` }]}>
                    <Text style={[tp.phaseChipText, { color: t.color }]}>{p.replace('_', ' ')}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Feather name="chevron-right" size={16} color={muted} />
          </GlassView>
        </TouchableOpacity>
      ))}
      <TouchableOpacity onPress={onSkip} style={[tp.skipBtn, { borderColor: `${primary}30` }]}>
        <Feather name="plus" size={16} color={primary} />
        <Text style={[tp.skipText, { color: primary }]}>Start from scratch</Text>
      </TouchableOpacity>
    </ScrollView>
  </View>
);

const tp = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '900', marginBottom: 4 },
  sub: { fontSize: 12, lineHeight: 17 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  icon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 14, fontWeight: '900', marginBottom: 3 },
  cardDesc: { fontSize: 11, lineHeight: 15, marginBottom: 8 },
  phasesRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  phaseChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  phaseChipText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  skipBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginTop: 4 },
  skipText: { fontSize: 13, fontWeight: '800' },
});

// ── Reach Estimator ───────────────────────────────────────────────────────────
const estimateReach = (targeting) => {
  let base = 50000;
  Object.values(targeting).forEach(cat => {
    if (!cat) return;
    Object.values(cat).forEach(val => {
      if (Array.isArray(val) && val.length > 0) base = Math.floor(base * (0.6 + Math.random() * 0.3));
      if (typeof val === 'string' && val) base = Math.floor(base * 0.85);
    });
  });
  return Math.max(100, base);
};

// ── Main Modal ────────────────────────────────────────────────────────────────
export const CampaignBuilderModal = ({ visible, onClose, businessId, existing, onSaved, primary, textColor, muted, bg }) => {
  const [step, setStep]               = useState(1);
  const [templatePicker, setTemplatePicker] = useState(true);
  const [saving, setSaving]           = useState(false);

  const [form, setForm] = useState({
    name: '', campaign_type: 'event_promo', headline: '', subline: '',
    cta_text: 'Learn More', cta_url: '', budget_total: '', start_date: '', end_date: '',
  });
  const [targeting, setTargeting] = useState({});
  const [phases, setPhases] = useState([]);

  useEffect(() => {
    setTemplatePicker(!existing);
    if (existing) {
      setForm({
        name: existing.name || '',
        campaign_type: existing.campaign_type || 'event_promo',
        headline: existing.headline || '',
        subline: existing.subline || '',
        cta_text: existing.cta_text || 'Learn More',
        cta_url: existing.cta_url || '',
        budget_total: existing.budget_total?.toString() || '',
        start_date: existing.start_date || '',
        end_date: existing.end_date || '',
      });
      setTargeting(existing.targeting || {});
      setPhases(existing.targeting?.event_phases || []);
    } else {
      setForm({ name: '', campaign_type: 'event_promo', headline: '', subline: '', cta_text: 'Learn More', cta_url: '', budget_total: '', start_date: '', end_date: '' });
      setTargeting({});
      setPhases([]);
    }
    setStep(1);
  }, [existing, visible]);

  const reach = estimateReach(targeting);

  const save = async () => {
    if (!form.name.trim()) { Alert.alert('Required', 'Campaign name is required.'); return; }
    if (!businessId) return;
    setSaving(true);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}

    const payload = {
      business_id: businessId,
      name: form.name.trim(),
      campaign_type: form.campaign_type,
      headline: form.headline,
      subline: form.subline,
      cta_text: form.cta_text,
      cta_url: form.cta_url,
      budget_total: parseFloat(form.budget_total) || 0,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: existing?.status || 'draft',
      targeting: { ...targeting, event_phases: phases },
    };

    try {
      const ok = existing
        ? await resilient(
            [
              () => supabase.from('ad_campaigns').update(payload).eq('id', existing.id),
              () => supabase.from('ad_campaigns').update({ title: payload.title, status: payload.status }).eq('id', existing.id),
              () => supabase.rpc('update_campaign', { p_campaign_id: existing.id, p_payload: payload }),
            ],
            { attemptsPerTier: 3, baseMs: 400, label: `CampaignBuilder.update:${existing.id}`, fallbackValue: null }
          )
        : await resilient(
            [
              () => supabase.from('ad_campaigns').insert(payload),
              () => supabase.from('ad_campaigns').upsert(payload),
              () => supabase.rpc('create_campaign', { p_payload: payload }),
            ],
            { attemptsPerTier: 3, baseMs: 400, label: 'CampaignBuilder.insert', fallbackValue: null }
          );
      if (ok === null) { Alert.alert('Error', 'Could not save campaign. Please try again.'); return; }
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const STEPS = [
    { label: 'Mission Details' },
    { label: 'Creative & War Chest' },
    { label: 'Crowd Targeting' },
    { label: 'Gruv Phases' },
  ];

  const renderStep = () => {
    switch (step) {
      case 1: return (
        <View style={{ gap: 4 }}>
          <Field label="Mission Name *" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} primary={primary} textColor={textColor} muted={muted} placeholder="e.g. Summer Gruv Push" />
          <Text style={[cms.fieldLabel, { color: muted }]}>MISSION TYPE</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {CAMPAIGN_TYPES.map(t => (
              <TouchableOpacity key={t} onPress={() => setForm(p => ({ ...p, campaign_type: t }))}
                style={[cms.chip, { borderColor: form.campaign_type === t ? primary : `${primary}25`, backgroundColor: form.campaign_type === t ? `${primary}20` : 'transparent' }]}>
                <Text style={[cms.chipText, { color: form.campaign_type === t ? primary : muted }]}>{t.replace('_', ' ').toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Field label="Start Date" value={form.start_date} onChange={v => setForm(p => ({ ...p, start_date: v }))} primary={primary} textColor={textColor} muted={muted} placeholder="YYYY-MM-DD" />
          <Field label="End Date" value={form.end_date} onChange={v => setForm(p => ({ ...p, end_date: v }))} primary={primary} textColor={textColor} muted={muted} placeholder="YYYY-MM-DD" />
        </View>
      );

      case 2: return (
        <View style={{ gap: 4 }}>
          <Field label="Ad Headline" value={form.headline} onChange={v => setForm(p => ({ ...p, headline: v }))} primary={primary} textColor={textColor} muted={muted} placeholder="Grab their attention..." />
          <Field label="Ad Subline" value={form.subline} onChange={v => setForm(p => ({ ...p, subline: v }))} primary={primary} textColor={textColor} muted={muted} placeholder="Supporting copy..." multiline />
          <Field label="CTA Text" value={form.cta_text} onChange={v => setForm(p => ({ ...p, cta_text: v }))} primary={primary} textColor={textColor} muted={muted} placeholder="RSVP Now" />
          <Field label="CTA URL (optional)" value={form.cta_url} onChange={v => setForm(p => ({ ...p, cta_url: v }))} primary={primary} textColor={textColor} muted={muted} placeholder="https://..." />
          <Field label="War Chest (R)" value={form.budget_total} onChange={v => setForm(p => ({ ...p, budget_total: v }))} primary={primary} textColor={textColor} muted={muted} placeholder="e.g. 500" keyboardType="numeric" />

          {/* Ad preview */}
          {(form.headline || form.subline) && (
            <GlassView style={[cms.adPreview, { borderColor: `${primary}30` }]}>
              <Text style={[cms.adPreviewLabel, { color: muted }]}>AD PREVIEW</Text>
              <View style={[cms.adPreviewBadge, { backgroundColor: `${primary}20` }]}>
                <Text style={[cms.adPreviewBadgeText, { color: primary }]}>SPONSORED</Text>
              </View>
              {form.headline ? <Text style={[cms.adPreviewHead, { color: textColor }]}>{form.headline}</Text> : null}
              {form.subline ? <Text style={[cms.adPreviewSub, { color: muted }]}>{form.subline}</Text> : null}
              {form.cta_text ? (
                <View style={[cms.adPreviewCta, { backgroundColor: primary }]}>
                  <Text style={{ color: '#000', fontSize: 11, fontWeight: '900' }}>{form.cta_text}</Text>
                </View>
              ) : null}
            </GlassView>
          )}
        </View>
      );

      case 3: return (
        <View>
          {/* Reach estimator */}
          <GlassView style={[cms.reachCard, { borderColor: `${primary}25` }]}>
            <View style={[cms.reachIcon, { backgroundColor: `${primary}18` }]}>
              <Feather name="users" size={18} color={primary} />
            </View>
            <View>
              <Text style={[cms.reachVal, { color: primary }]}>{reach.toLocaleString()}</Text>
              <Text style={[cms.reachLabel, { color: muted }]}>Estimated Crowd Size</Text>
            </View>
            <Text style={[cms.reachNote, { color: muted }]}>Tune your targeting to narrow or widen The Crowd</Text>
          </GlassView>

          {Object.entries(TARGETING).map(([catKey, category]) => (
            <TargetingSection key={catKey} catKey={catKey} category={category} targeting={targeting} setTargeting={setTargeting} primary={primary} textColor={textColor} muted={muted} />
          ))}
        </View>
      );

      case 4: return (
        <View>
          <GlassView style={[cms.phaseInfo, { borderColor: `${primary}20` }]}>
            <Feather name="info" size={14} color={primary} />
            <Text style={[cms.phaseInfoText, { color: muted }]}>
              Select which Gruv phases this Mission targets. Each phase unlocks different placement spots and Crowd mindsets.
            </Text>
          </GlassView>

          {[
            { key: 'pre_event',    label: 'PRE-GRUV',     icon: 'clock', color: "#8b5cf6", desc: 'Reach Vibers who Vibed or Scouted a Gruv. Target: Transport, outfits, accommodation, hype content, dining reservations.' },
            { key: 'during_event', label: 'IN THE GRUV',  icon: 'zap',   color: primary,   desc: 'Reach Vibers who Touched Down at a Gruv. Target: Food & drinks, merch, shot booths, Royale upgrades, next Gruv teaser.' },
            { key: 'post_event',   label: 'POST-GRUV',    icon: 'star',  color: "#10b981", desc: 'Reach Vibers after the Gruv ends. Target: Shots, reviews, highlight reels, next Gruv early Passes, community groups.' },
          ].map(phase => {
            const active = phases.includes(phase.key);
            return (
              <TouchableOpacity key={phase.key} onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
                setPhases(p => active ? p.filter(x => x !== phase.key) : [...p, phase.key]);
              }} activeOpacity={0.8}>
                <GlassView style={[cms.phaseCard, { borderColor: active ? phase.color : `${phase.color}25`, backgroundColor: active ? `${phase.color}08` : 'transparent' }]}>
                  <View style={cms.phaseTop}>
                    <View style={[cms.phaseIconWrap, { backgroundColor: `${phase.color}20` }]}>
                      <Feather name={phase.icon} size={18} color={phase.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[cms.phaseLabel, { color: active ? phase.color : textColor }]}>{phase.label}</Text>
                    </View>
                    <View style={[cms.phaseCheck, { borderColor: active ? phase.color : `${phase.color}30`, backgroundColor: active ? phase.color : 'transparent' }]}>
                      {active && <Feather name="check" size={12} color="#000" />}
                    </View>
                  </View>
                  <Text style={[cms.phaseDesc, { color: muted }]}>{phase.desc}</Text>
                </GlassView>
              </TouchableOpacity>
            );
          })}

          {/* Automated notification preview */}
          {phases.length > 0 && (
            <GlassView style={[cms.notifPreview, { borderColor: `${primary}20` }]}>
              <Text style={[cms.notifPreviewTitle, { color: textColor }]}>Auto Pings Activated</Text>
              <Text style={[cms.notifPreviewBody, { color: muted }]}>Vibers in your Crowd will receive Pings during the selected Gruv phases. Ping cadence: max 1 per phase per Vibe per Gruv.</Text>
            </GlassView>
          )}
        </View>
      );

      default: return null;
    }
  };

  const applyTemplate = (template) => {
    setForm(template.form);
    setTargeting(template.targeting);
    setPhases(template.phases);
    setTemplatePicker(false);
    setStep(1);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[cms.modal, { backgroundColor: bg }]}>
        <LiquidBackground intensity={0.7} />
        {/* Header */}
        <View style={[cms.header, { borderBottomColor: `${primary}15` }]}>
          <TouchableOpacity onPress={templatePicker ? onClose : () => setTemplatePicker(true)} style={cms.closeBtn}>
            <Feather name={templatePicker ? 'x' : 'arrow-left'} size={20} color={textColor} />
          </TouchableOpacity>
          <Text style={[cms.headerTitle, { color: textColor }]}>
            {templatePicker ? 'New Mission' : existing ? 'Edit Mission' : 'New Mission'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Template picker replaces step content when active */}
        {templatePicker ? (
          <TemplatePicker
            onSelect={applyTemplate}
            onSkip={() => setTemplatePicker(false)}
            primary={primary} textColor={textColor} muted={muted}
          />
        ) : (
          <>
            {/* Step indicator */}
            <View style={[cms.stepBar, { borderBottomColor: `${primary}10` }]}>
              {STEPS.map((s, i) => {
                const n = i + 1;
                const done = n < step;
                const active = n === step;
                return (
                  <TouchableOpacity key={n} onPress={() => n <= step && setStep(n)} style={cms.stepItem}>
                    <View style={[cms.stepCircle, { borderColor: active ? primary : done ? "#10b981" : `${primary}20`, backgroundColor: done ? "#10b981" : active ? `${primary}20` : 'transparent' }]}>
                      {done
                        ? <Feather name="check" size={10} color="#fff" />
                        : <Text style={[cms.stepNum, { color: active ? primary : muted }]}>{n}</Text>}
                    </View>
                    <Text style={[cms.stepLabel, { color: active ? primary : muted }]} numberOfLines={1}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
              {renderStep()}
            </ScrollView>

            {/* Bottom nav */}
            <View style={[cms.bottomNav, { borderTopColor: `${primary}15`, backgroundColor: `${bg}ee` }]}>
          {step > 1 && (
            <TouchableOpacity onPress={() => setStep(s => s - 1)} style={[cms.navBtn, { borderColor: `${primary}30` }]}>
              <Feather name="arrow-left" size={16} color={primary} />
              <Text style={[cms.navBtnText, { color: primary }]}>Back</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {step < STEPS.length ? (
            <TouchableOpacity onPress={() => setStep(s => s + 1)} style={[cms.navBtnPrimary, { backgroundColor: primary }]}>
              <Text style={cms.navBtnPrimaryText}>NEXT</Text>
              <Feather name="arrow-right" size={16} color="#000" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={save} style={[cms.navBtnPrimary, { backgroundColor: primary }]} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#000" />
                : <><Feather name="save" size={16} color="#000" /><Text style={cms.navBtnPrimaryText}>{existing ? 'UPDATE' : 'LAUNCH'}</Text></>}
            </TouchableOpacity>
          )}
            </View>
          </>
        )}
      </View>
    </Modal>
  );
};

const Field = ({ label, value, onChange, multiline, placeholder, primary, textColor, muted, keyboardType }) => (
  <View style={{ marginBottom: 16 }}>
    {label && <Text style={[cms.fieldLabel, { color: muted }]}>{label.toUpperCase()}</Text>}
    <TextInput
      style={[cms.input, { color: textColor, borderColor: `${primary}25`, minHeight: multiline ? 80 : 46 }]}
      value={value || ''}
      onChangeText={onChange}
      placeholder={placeholder || ''}
      placeholderTextColor={muted}
      multiline={multiline}
      keyboardType={keyboardType || 'default'}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  </View>
);

const cms = StyleSheet.create({
  modal: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  // Steps
  stepBar: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, gap: 8 },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 9, fontWeight: '900' },
  stepLabel: { fontSize: 8, fontWeight: '700', textAlign: 'center' },
  // Fields
  fieldLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  fieldWrap: { marginBottom: 4, paddingTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, textAlignVertical: 'top' },
  numInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, width: 120 },
  // Targeting
  targetSection: { borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  targetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  targetIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  targetLabel: { fontSize: 13, fontWeight: '800' },
  targetActive: { fontSize: 10, fontWeight: '700', marginTop: 2 },
  // Multi select chips
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 10, fontWeight: '700' },
  // Tags
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  tagText: { fontSize: 10, fontWeight: '700' },
  tagInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  addTagBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  // Reach
  reachCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  reachIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  reachVal: { fontSize: 22, fontWeight: '900' },
  reachLabel: { fontSize: 10, fontWeight: '700' },
  reachNote: { flex: 1, fontSize: 10, lineHeight: 14 },
  // Ad preview
  adPreview: { padding: 16, borderRadius: 16, borderWidth: 1, marginTop: 16 },
  adPreviewLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  adPreviewBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 8 },
  adPreviewBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  adPreviewHead: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  adPreviewSub: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  adPreviewCta: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  // Phases
  phaseInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  phaseInfoText: { flex: 1, fontSize: 11, lineHeight: 16 },
  phaseCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  phaseTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  phaseIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  phaseLabel: { fontSize: 13, fontWeight: '900' },
  phaseCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  phaseDesc: { fontSize: 11, lineHeight: 17 },
  notifPreview: { padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 4 },
  notifPreviewTitle: { fontSize: 12, fontWeight: '900', marginBottom: 6 },
  notifPreviewBody: { fontSize: 11, lineHeight: 16 },
  // Bottom nav
  bottomNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 32, borderTopWidth: 1, gap: 10 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  navBtnText: { fontSize: 13, fontWeight: '800' },
  navBtnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  navBtnPrimaryText: { color: '#000', fontSize: 13, fontWeight: '900' },
});

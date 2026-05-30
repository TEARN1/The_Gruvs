/**
 * BusinessStoreBuilder — Wix-like block-based storefront builder.
 * Blocks: Hero · Text · Gallery · CTA · Countdown · Testimonials · Services · Contact · Socials · Stats · Map · FAQ
 * Each block is stored as JSONB in `business_page_blocks` in Supabase.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Modal, Alert, Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';
import { resilient } from '../utils/resilience';
import { GlassView } from '../components/GlassView';
import { ErrorBoundary } from '../components/ErrorBoundary';


const BLOCK_TYPES = [
  { type: 'hero', label: 'Hero Banner', icon: 'image', desc: 'Big headline, tagline, and CTA button' },
  { type: 'text', label: 'Text Block', icon: 'file-text', desc: 'Rich formatted text section' },
  { type: 'gallery', label: 'Photo Gallery', icon: 'grid', desc: 'Image grid or carousel' },
  { type: 'cta', label: 'Call to Action', icon: 'zap', desc: 'Bold action button with subtext' },
  { type: 'countdown', label: 'Countdown Timer', icon: 'clock', desc: 'Live countdown to your event' },
  { type: 'testimonials', label: 'Testimonials', icon: 'star', desc: 'Reviews and quotes from attendees' },
  { type: 'services', label: 'Services / Pricing', icon: 'package', desc: 'Service cards with prices' },
  { type: 'contact', label: 'Contact Form', icon: 'mail', desc: 'Lead capture form' },
  { type: 'promotions', label: 'Deals & Promos', icon: 'tag', desc: 'Showcase active discounts or vouchers' },
  { type: 'socials', label: 'Social Links', icon: 'share-2', desc: 'Instagram, TikTok, WhatsApp, etc.' },
  { type: 'stats', label: 'Stats Bar', icon: 'bar-chart-2', desc: 'Key numbers — events, attendees, etc.' },
  { type: 'map', label: 'Map / Location', icon: 'map-pin', desc: 'Embedded map or address block' },
  { type: 'faq', label: 'FAQ', icon: 'help-circle', desc: 'Collapsible questions and answers' },
  { type: 'video', label: 'Video Embed', icon: 'video', desc: 'YouTube or direct video link' },
  { type: 'team', label: 'Team Members', icon: 'users', desc: 'Introduce your crew' },
  { type: 'sponsors', label: 'Sponsors Wall', icon: 'award', desc: 'Display sponsor logos and tiers' },
];

const THEME_PRESETS = [
  { id: 'midnight', label: 'Midnight', bg: '#0d1112', primary: '#00f2ff', text: '#ffffff' },
  { id: 'royal', label: 'Royal', bg: '#0a0a1a', primary: '#8b5cf6', text: '#e8e8ff' },
  { id: 'ember', label: 'Ember', bg: '#1a0a00', primary: '#f59e0b', text: '#fff8e8' },
  { id: 'forest', label: 'Forest', bg: '#040d0a', primary: '#10b981', text: '#e8fff5' },
  { id: 'crimson', label: 'Crimson', bg: '#1a0505', primary: '#ef4444', text: '#ffe8e8' },
  { id: 'pearl', label: 'Pearl', bg: '#f8f9fa', primary: '#1e293b', text: '#1e293b' },
  { id: 'slate', label: 'Slate', bg: '#1e293b', primary: '#38bdf8', text: '#e2e8f0' },
  { id: 'gold', label: 'Gold Rush', bg: '#111108', primary: '#eab308', text: '#fefce8' },
];

const defaultConfig = {
  hero: { headline: '', tagline: '', cta_text: 'Learn More', cta_url: '', bg_color: '' },
  text: { content: '', align: 'left' },
  gallery: { urls: [], layout: 'grid' },
  cta: { headline: '', subtext: '', button_text: 'Get Started', button_url: '', color: '' },
  countdown: { target_date: '', label: '' },
  testimonials: { items: [] },
  services: { items: [], currency: 'R' },
  contact: { email: '', fields: ['name', 'email', 'message'] },
  socials: { instagram: '', tiktok: '', whatsapp: '', twitter: '', youtube: '' },
  stats: { items: [] },
  map: { address: '', embed_url: '' },
  faq: { items: [] },
  promotions: { items: [], currency: 'R' },
  video: { url: '', title: '' },
  team: { members: [] },
  sponsors: { tiers: [] },
};

// ── Block Preview Card ────────────────────────────────────────────────────────
const BlockPreviewCard = ({ block, primary, textColor, muted, onEdit, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) => {
  const btype = BLOCK_TYPES.find(b => b.type === block.block_type) || {};
  const cfg = block.config || {};

  const renderPreview = () => {
    switch (block.block_type) {
      case 'hero': return (
        <View style={bps.heroPreview}>
          <Text style={[bps.heroHeadline, { color: textColor }]}>{cfg.headline || 'Your Headline Here'}</Text>
          {cfg.tagline ? <Text style={[bps.heroTagline, { color: muted }]}>{cfg.tagline}</Text> : null}
          {cfg.cta_text ? (
            <View style={[bps.heroCta, { backgroundColor: primary }]}>
              <Text style={{ color: '#000', fontSize: 10, fontWeight: '900' }}>{cfg.cta_text}</Text>
            </View>
          ) : null}
        </View>
      );
      case 'text': return <Text style={[bps.textPreview, { color: textColor }]} numberOfLines={3}>{cfg.content || 'Your text content...'}</Text>;
      case 'cta': return (
        <View style={bps.ctaPreview}>
          <Text style={[bps.ctaHeadline, { color: textColor }]}>{cfg.headline || 'Ready to join?'}</Text>
          <View style={[bps.ctaBtn, { backgroundColor: cfg.color || primary }]}>
            <Text style={{ color: '#000', fontSize: 10, fontWeight: '900' }}>{cfg.button_text || 'Get Started'}</Text>
          </View>
        </View>
      );
      case 'countdown': return (
        <View style={bps.countdownPreview}>
          <Text style={[bps.countdownLabel, { color: muted }]}>{cfg.label || 'Event starts in'}</Text>
          <View style={bps.countdownBlocks}>
            {['00', '00', '00', '00'].map((v, i) => (
              <View key={i} style={[bps.countdownBlock, { backgroundColor: `${primary}20` }]}>
                <Text style={[bps.countdownNum, { color: primary }]}>{v}</Text>
                <Text style={[bps.countdownUnit, { color: muted }]}>{['D', 'H', 'M', 'S'][i]}</Text>
              </View>
            ))}
          </View>
        </View>
      );
      case 'services': return (
        <View style={bps.servicesRow}>
          {(cfg.items || [{ name: 'VIP Ticket', price: '350', desc: 'All access' }]).slice(0, 2).map((item, i) => (
            <View key={i} style={[bps.serviceCard, { borderColor: `${primary}25` }]}>
              <Text style={[bps.servicePrice, { color: primary }]}>{cfg.currency || 'R'}{item.price}</Text>
              <Text style={[bps.serviceName, { color: textColor }]}>{item.name}</Text>
            </View>
          ))}
        </View>
      );
      case 'promotions': return (
        <View style={{ gap: 6 }}>
          {(cfg.items || [{ title: '20% Off Drinks', value: '20%', req: '50' }]).slice(0, 2).map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: `${primary}10`, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: `${primary}20` }}>
              <Text style={{ color: primary, fontWeight: '900', fontSize: 14 }}>{item.value}</Text>
              <Text style={{ color: textColor, fontSize: 11, flex: 1 }}>{item.title}</Text>
              <View style={{ backgroundColor: primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}><Text style={{ color: '#000', fontSize: 8, fontWeight: '900' }}>⚡ {item.req}+</Text></View>
            </View>
          ))}
        </View>
      );
      case 'stats': return (
        <View style={bps.statsRow}>
          {(cfg.items || [{ label: 'Events', value: '0' }, { label: 'Vibers', value: '0' }]).slice(0, 3).map((s, i) => (
            <View key={i} style={bps.statItem}>
              <Text style={[bps.statVal, { color: primary }]}>{s.value}</Text>
              <Text style={[bps.statLbl, { color: muted }]}>{s.label}</Text>
            </View>
          ))}
        </View>
      );
      default: return <Text style={[{ color: muted, fontSize: 11 }]}>{btype.desc || 'Block preview'}</Text>;
    }
  };

  return (
    <GlassView style={[bps.blockCard, { borderColor: block.visible ? `${primary}25` : 'rgba(255,255,255,0.08)', opacity: block.visible ? 1 : 0.5 }]}>
      <View style={bps.blockHeader}>
        <View style={[bps.blockTypeBadge, { backgroundColor: `${primary}18` }]}>
          <Feather name={btype.icon || 'square'} size={12} color={primary} />
          <Text style={[bps.blockTypeLabel, { color: primary }]}>{btype.label}</Text>
        </View>
        <View style={bps.blockActions}>
          {!isFirst && <TouchableOpacity onPress={onMoveUp} style={bps.actionBtn}><Feather name="chevron-up" size={14} color={muted} /></TouchableOpacity>}
          {!isLast && <TouchableOpacity onPress={onMoveDown} style={bps.actionBtn}><Feather name="chevron-down" size={14} color={muted} /></TouchableOpacity>}
          <TouchableOpacity onPress={onEdit} style={bps.actionBtn}><Feather name="edit-2" size={14} color={primary} /></TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={bps.actionBtn}><Feather name="trash-2" size={14} color="#ef4444" /></TouchableOpacity>
        </View>
      </View>
      <View style={bps.blockPreviewArea}>{renderPreview()}</View>
    </GlassView>
  );
};

// ── Block Editor Modal ────────────────────────────────────────────────────────
const BlockEditorModal = ({ visible, block, onClose, onSave, primary, textColor, muted, bg }) => {
  const [config, setConfig] = useState({});
  const [itemInput, setItemInput] = useState({ name: '', value: '', price: '', desc: '', q: '', a: '' });

  useEffect(() => {
    if (block) setConfig(block.config || defaultConfig[block.block_type] || {});
  }, [block]);

  if (!block) return null;

  const set = (key, val) => setConfig(p => ({ ...p, [key]: val }));

  const renderFields = () => {
    switch (block.block_type) {
      case 'hero': return (
        <>
          <Field label="Headline *" value={config.headline} onChange={v => set('headline', v)} textColor={textColor} muted={muted} primary={primary} />
          <Field label="Tagline" value={config.tagline} onChange={v => set('tagline', v)} textColor={textColor} muted={muted} primary={primary} />
          <Field label="CTA Button Text" value={config.cta_text} onChange={v => set('cta_text', v)} textColor={textColor} muted={muted} primary={primary} />
          <Field label="CTA URL (optional)" value={config.cta_url} onChange={v => set('cta_url', v)} textColor={textColor} muted={muted} primary={primary} />
          <Field label="Background Color (hex)" value={config.bg_color} onChange={v => set('bg_color', v)} textColor={textColor} muted={muted} primary={primary} placeholder="#00f2ff" />
        </>
      );
      case 'text': return (
        <>
          <Field label="Content" value={config.content} onChange={v => set('content', v)} multiline textColor={textColor} muted={muted} primary={primary} />
          <Text style={[bem.label, { color: muted }]}>TEXT ALIGN</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {['left', 'center', 'right'].map(a => (
              <TouchableOpacity key={a} onPress={() => set('align', a)} style={[bem.alignBtn, { borderColor: config.align === a ? primary : `${primary}25`, backgroundColor: config.align === a ? `${primary}20` : 'transparent' }]}>
                <Text style={{ color: config.align === a ? primary : muted, fontSize: 11, fontWeight: '800' }}>{a.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      );
      case 'cta': return (
        <>
          <Field label="Headline" value={config.headline} onChange={v => set('headline', v)} textColor={textColor} muted={muted} primary={primary} />
          <Field label="Subtext" value={config.subtext} onChange={v => set('subtext', v)} textColor={textColor} muted={muted} primary={primary} />
          <Field label="Button Text" value={config.button_text} onChange={v => set('button_text', v)} textColor={textColor} muted={muted} primary={primary} />
          <Field label="Button URL" value={config.button_url} onChange={v => set('button_url', v)} textColor={textColor} muted={muted} primary={primary} />
          <Field label="Button Color (hex)" value={config.color} onChange={v => set('color', v)} textColor={textColor} muted={muted} primary={primary} placeholder="#00f2ff" />
        </>
      );
      case 'countdown': return (
        <>
          <Field label="Target Date (YYYY-MM-DDTHH:MM)" value={config.target_date} onChange={v => set('target_date', v)} textColor={textColor} muted={muted} primary={primary} placeholder="2025-12-31T20:00" />
          <Field label="Label" value={config.label} onChange={v => set('label', v)} textColor={textColor} muted={muted} primary={primary} placeholder="Event starts in" />
        </>
      );
      case 'services': return (
        <>
          <Field label="Currency Symbol" value={config.currency} onChange={v => set('currency', v)} textColor={textColor} muted={muted} primary={primary} placeholder="R" />
          <Text style={[bem.label, { color: muted }]}>ADD SERVICE</Text>
          <View style={{ gap: 8, marginBottom: 10 }}>
            {[['name', 'Service Name'], ['price', 'Price'], ['desc', 'Description']].map(([k, pl]) => (
              <TextInput key={k} style={[bem.miniInput, { color: textColor, borderColor: `${primary}25` }]} placeholder={pl} placeholderTextColor={muted} value={itemInput[k]} onChangeText={v => setItemInput(p => ({ ...p, [k]: v }))} />
            ))}
            <TouchableOpacity onPress={() => {
              if (!itemInput.name) return;
              set('items', [...(config.items || []), { name: itemInput.name, price: itemInput.price, desc: itemInput.desc }]);
              setItemInput(p => ({ ...p, name: '', price: '', desc: '' }));
            }} style={[bem.addBtn, { borderColor: `${primary}40`, backgroundColor: `${primary}10` }]}>
              <Feather name="plus" size={14} color={primary} />
              <Text style={[bem.addBtnText, { color: primary }]}>ADD</Text>
            </TouchableOpacity>
          </View>
          {(config.items || []).map((item, i) => (
            <View key={i} style={[bem.listItem, { borderColor: `${primary}15` }]}>
              <Text style={{ color: textColor, fontSize: 12, flex: 1 }}>{item.name} — {config.currency || 'R'}{item.price}</Text>
              <TouchableOpacity onPress={() => set('items', config.items.filter((_, j) => j !== i))}>
                <Feather name="x" size={14} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </>
      );
      case 'promotions': return (
        <>
          <Field label="Currency Symbol" value={config.currency} onChange={v => set('currency', v)} placeholder="R" textColor={textColor} muted={muted} primary={primary} />
          <Text style={[bem.label, { color: muted }]}>ADD PROMOTION</Text>
          <View style={{ gap: 8, marginBottom: 10 }}>
            {[['title', 'Promo Title (e.g. Early Bird)'], ['value', 'Discount (e.g. 15% or R50)'], ['req', 'Min Vibe Score']].map(([k, pl]) => (
              <TextInput key={k} style={[bem.miniInput, { color: textColor, borderColor: `${primary}25` }]} placeholder={pl} placeholderTextColor={muted} value={itemInput[k]} onChangeText={v => setItemInput(p => ({ ...p, [k]: v }))} keyboardType={k === 'req' ? 'numeric' : 'default'} />
            ))}
            <TouchableOpacity onPress={() => {
              if (!itemInput.title) return;
              set('items', [...(config.items || []), { title: itemInput.title, value: itemInput.value, req: itemInput.req }]);
              setItemInput(p => ({ ...p, title: '', value: '', req: '' }));
            }} style={[bem.addBtn, { borderColor: `${primary}40`, backgroundColor: `${primary}10` }]}>
              <Feather name="plus" size={14} color={primary} />
              <Text style={[bem.addBtnText, { color: primary }]}>ADD DEAL</Text>
            </TouchableOpacity>
          </View>
          {(config.items || []).map((item, i) => (
            <View key={i} style={[bem.listItem, { borderColor: `${primary}15` }]}>
              <Text style={{ color: textColor, fontSize: 12, flex: 1 }}>{item.value} — {item.title} (Score: {item.req}+)</Text>
              <TouchableOpacity onPress={() => set('items', config.items.filter((_, j) => j !== i))}><Feather name="x" size={14} color="#ef4444" /></TouchableOpacity>
            </View>
          ))}
        </>
      );
      case 'stats': return (
        <>
          <Text style={[bem.label, { color: muted }]}>ADD STAT</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <TextInput style={[bem.miniInput, { flex: 1, color: textColor, borderColor: `${primary}25` }]} placeholder="Label" placeholderTextColor={muted} value={itemInput.name} onChangeText={v => setItemInput(p => ({ ...p, name: v }))} />
            <TextInput style={[bem.miniInput, { flex: 1, color: textColor, borderColor: `${primary}25` }]} placeholder="Value" placeholderTextColor={muted} value={itemInput.value} onChangeText={v => setItemInput(p => ({ ...p, value: v }))} />
            <TouchableOpacity onPress={() => {
              if (!itemInput.name) return;
              set('items', [...(config.items || []), { label: itemInput.name, value: itemInput.value }]);
              setItemInput(p => ({ ...p, name: '', value: '' }));
            }} style={[bem.addBtn, { borderColor: `${primary}40`, backgroundColor: `${primary}10` }]}>
              <Feather name="plus" size={14} color={primary} />
            </TouchableOpacity>
          </View>
          {(config.items || []).map((item, i) => (
            <View key={i} style={[bem.listItem, { borderColor: `${primary}15` }]}>
              <Text style={{ color: textColor, fontSize: 12, flex: 1 }}>{item.label}: {item.value}</Text>
              <TouchableOpacity onPress={() => set('items', config.items.filter((_, j) => j !== i))}>
                <Feather name="x" size={14} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </>
      );
      case 'faq': return (
        <>
          <Text style={[bem.label, { color: muted }]}>ADD FAQ ITEM</Text>
          <View style={{ gap: 8, marginBottom: 10 }}>
            {[['q', 'Question'], ['a', 'Answer']].map(([k, pl]) => (
              <TextInput key={k} style={[bem.miniInput, { color: textColor, borderColor: `${primary}25`, minHeight: k === 'a' ? 60 : 44 }]} placeholder={pl} placeholderTextColor={muted} value={itemInput[k]} onChangeText={v => setItemInput(p => ({ ...p, [k]: v }))} multiline={k === 'a'} />
            ))}
            <TouchableOpacity onPress={() => {
              if (!itemInput.q) return;
              set('items', [...(config.items || []), { q: itemInput.q, a: itemInput.a }]);
              setItemInput(p => ({ ...p, q: '', a: '' }));
            }} style={[bem.addBtn, { borderColor: `${primary}40`, backgroundColor: `${primary}10` }]}>
              <Feather name="plus" size={14} color={primary} />
              <Text style={[bem.addBtnText, { color: primary }]}>ADD</Text>
            </TouchableOpacity>
          </View>
          {(config.items || []).map((item, i) => (
            <View key={i} style={[bem.listItem, { borderColor: `${primary}15` }]}>
              <Text style={{ color: textColor, fontSize: 12, flex: 1 }} numberOfLines={2}>{item.q}</Text>
              <TouchableOpacity onPress={() => set('items', config.items.filter((_, j) => j !== i))}>
                <Feather name="x" size={14} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
        </>
      );
      case 'socials': return (
        <>
          {[['instagram', 'Instagram handle'], ['tiktok', 'TikTok handle'], ['whatsapp', 'WhatsApp number'], ['twitter', 'Twitter/X handle'], ['youtube', 'YouTube URL']].map(([k, pl]) => (
            <Field key={k} label={k.toUpperCase()} value={config[k]} onChange={v => set(k, v)} placeholder={pl} textColor={textColor} muted={muted} primary={primary} />
          ))}
        </>
      );
      case 'contact': return (
        <Field label="Contact Email" value={config.email} onChange={v => set('email', v)} textColor={textColor} muted={muted} primary={primary} placeholder="hello@yourbusiness.com" />
      );
      case 'map': return (
        <>
          <Field label="Address" value={config.address} onChange={v => set('address', v)} textColor={textColor} muted={muted} primary={primary} placeholder="123 Main St, Johannesburg" />
          <Field label="Google Maps Embed URL (optional)" value={config.embed_url} onChange={v => set('embed_url', v)} textColor={textColor} muted={muted} primary={primary} />
        </>
      );
      case 'video': return (
        <>
          <Field label="Video URL (YouTube or direct)" value={config.url} onChange={v => set('url', v)} textColor={textColor} muted={muted} primary={primary} />
          <Field label="Caption" value={config.title} onChange={v => set('title', v)} textColor={textColor} muted={muted} primary={primary} />
        </>
      );
      case 'gallery': return (
        <>
          <Text style={[bem.label, { color: muted }]}>LAYOUT</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {['grid', 'carousel'].map(l => (
              <TouchableOpacity key={l} onPress={() => set('layout', l)} style={[bem.alignBtn, { borderColor: config.layout === l ? primary : `${primary}25`, backgroundColor: config.layout === l ? `${primary}20` : 'transparent' }]}>
                <Text style={{ color: config.layout === l ? primary : muted, fontSize: 11, fontWeight: '800' }}>{l.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Field label="Add Image URL" value={itemInput.value} onChange={v => setItemInput(p => ({ ...p, value: v }))} placeholder="https://..." textColor={textColor} muted={muted} primary={primary} />
          <TouchableOpacity onPress={() => {
            if (!itemInput.value) return;
            set('urls', [...(config.urls || []), itemInput.value]);
            setItemInput(p => ({ ...p, value: '' }));
          }} style={[bem.addBtn, { borderColor: `${primary}40`, backgroundColor: `${primary}10` }]}>
            <Feather name="plus" size={14} color={primary} />
            <Text style={[bem.addBtnText, { color: primary }]}>ADD IMAGE</Text>
          </TouchableOpacity>
          <Text style={[{ color: muted, fontSize: 10, marginTop: 8 }]}>{(config.urls || []).length} image(s) added</Text>
        </>
      );
      default: return <Text style={{ color: muted }}>No configuration needed.</Text>;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[bem.modal, { backgroundColor: bg }]}>
        <View style={[bem.modalHeader, { borderBottomColor: `${primary}15` }]}>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={20} color={textColor} /></TouchableOpacity>
          <Text style={[bem.modalTitle, { color: textColor }]}>Edit {BLOCK_TYPES.find(b => b.type === block.block_type)?.label}</Text>
          <TouchableOpacity onPress={() => onSave(config)} style={[bem.saveBtn, { backgroundColor: primary }]}>
            <Text style={bem.saveBtnText}>SAVE</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          {renderFields()}
        </ScrollView>
      </View>
    </Modal>
  );
};

const Field = ({ label, value, onChange, multiline, placeholder, textColor, muted, primary }) => (
  <View style={{ marginBottom: 16 }}>
    {label && <Text style={[bem.label, { color: muted }]}>{label.toUpperCase()}</Text>}
    <TextInput
      style={[bem.input, { color: textColor, borderColor: `${primary}25`, minHeight: multiline ? 80 : 46 }]}
      value={value || ''}
      onChangeText={onChange}
      placeholder={placeholder || ''}
      placeholderTextColor={muted}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  </View>
);

// ── AddBlockModal ─────────────────────────────────────────────────────────────
const AddBlockModal = ({ visible, onClose, onAdd, primary, textColor, muted, bg }) => (
  <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <View style={[abm.modal, { backgroundColor: bg }]}>
      <View style={[abm.header, { borderBottomColor: `${primary}15` }]}>
        <TouchableOpacity onPress={onClose}><Feather name="x" size={20} color={textColor} /></TouchableOpacity>
        <Text style={[abm.title, { color: textColor }]}>Add Block</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {BLOCK_TYPES.map(bt => (
          <TouchableOpacity key={bt.type} onPress={() => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { } onAdd(bt.type); onClose(); }}
            style={[abm.blockOption, { borderColor: `${primary}20` }]} activeOpacity={0.8}>
            <View style={[abm.blockOptionIcon, { backgroundColor: `${primary}15` }]}>
              <Feather name={bt.icon} size={18} color={primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[abm.blockOptionLabel, { color: textColor }]}>{bt.label}</Text>
              <Text style={[abm.blockOptionDesc, { color: muted }]}>{bt.desc}</Text>
            </View>
            <Feather name="chevron-right" size={14} color={muted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  </Modal>
);

// ── Loading skeleton ──────────────────────────────────────────────────────────
const StoreSkeleton = ({ primary, bg }) => {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  return (
    <View style={{ flex: 1, backgroundColor: bg, padding: 16, gap: 12 }}>
      <Animated.View style={{ opacity: pulse, gap: 12 }}>
        <View style={{ height: 160, borderRadius: 14, backgroundColor: `${primary}12` }} />
        <View style={{ height: 80, borderRadius: 14, backgroundColor: `${primary}10` }} />
        <View style={{ height: 80, borderRadius: 14, backgroundColor: `${primary}08` }} />
        <View style={{ height: 80, borderRadius: 14, backgroundColor: `${primary}06` }} />
      </Animated.View>
    </View>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const BusinessStoreBuilder = ({ biz, primary, textColor, muted, bg }) => {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [editBlock, setEditBlock] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(THEME_PRESETS[0]);
  const [storeEnabled, setStoreEnabled] = useState(false);
  const [slug, setSlug] = useState(biz?.store_slug || '');

  useEffect(() => { if (biz?.id) loadBlocks(); }, [biz?.id]);

  const loadBlocks = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('business_page_blocks')
        .select('*')
        .eq('business_id', biz.id)
        .order('position', { ascending: true });
      setBlocks(data || []);
    } catch {
      // keep existing blocks on transient failure
    } finally {
      setLoading(false);
    }
  };

  const addBlock = async (type) => {
    const position = blocks.length;
    const { data, error } = await supabase
      .from('business_page_blocks')
      .insert({ business_id: biz.id, block_type: type, position, config: defaultConfig[type] || {}, visible: true })
      .select().single();
    if (!error && data) {
      setBlocks(p => [...p, data]);
      setEditBlock(data);
    }
  };

  const saveBlock = async (blockId, config) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch { }
    setBlocks(p => p.map(b => b.id === blockId ? { ...b, config } : b));
    setEditBlock(null);
    await resilient(
      [
        () => supabase.from('business_page_blocks').update({ config }).eq('id', blockId),
        () => supabase.from('business_page_blocks').update({ config: JSON.stringify(config) }).eq('id', blockId),
        () => supabase.rpc('update_page_block', { p_block_id: blockId, p_config: config }),
      ],
      { attemptsPerTier: 2, baseMs: 400, label: `StoreBuilder.saveBlock:${blockId}`, fallbackValue: null }
    );
  };

  const deleteBlock = async (blockId) => {
    Alert.alert('Delete Block', 'Remove this block from your store?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setBlocks(p => p.filter(b => b.id !== blockId));
          await resilient(
            [
              () => supabase.from('business_page_blocks').delete().eq('id', blockId),
              () => supabase.from('business_page_blocks').update({ deleted: true }).eq('id', blockId),
              () => supabase.rpc('delete_page_block', { p_block_id: blockId }),
            ],
            { attemptsPerTier: 2, baseMs: 400, label: `StoreBuilder.deleteBlock:${blockId}`, fallbackValue: null }
          );
        }
      },
    ]);
  };

  const moveBlock = async (blockId, direction) => {
    const idx = blocks.findIndex(b => b.id === blockId);
    if ((direction === -1 && idx === 0) || (direction === 1 && idx === blocks.length - 1)) return;
    const newBlocks = [...blocks];
    const swap = idx + direction;
    [newBlocks[idx], newBlocks[swap]] = [newBlocks[swap], newBlocks[idx]];
    // Re-index positions
    const updated = newBlocks.map((b, i) => ({ ...b, position: i }));
    setBlocks(updated);
    await resilient(
      [
        () => Promise.all(updated.map(b => supabase.from('business_page_blocks').update({ position: b.position }).eq('id', b.id))),
        () => Promise.allSettled(updated.map(b => supabase.from('business_page_blocks').update({ position: b.position }).eq('id', b.id))),
        () => supabase.rpc('reorder_page_blocks', { p_blocks: updated.map(b => ({ id: b.id, position: b.position })) }),
      ],
      { attemptsPerTier: 2, baseMs: 300, label: 'StoreBuilder.reorder', fallbackValue: null }
    );
  };

  const publishStore = async () => {
    if (!slug.trim()) { Alert.alert('Store URL', 'Please set a store URL slug first.'); return; }
    setSaving(true);
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch { }
    try {
      const storeSlug = slug.trim().toLowerCase().replace(/\s+/g, '-');
      const ok = await resilient(
        [
          // Tier 1: full update with store_enabled flag
          () => supabase.from('business_profiles').update({ store_enabled: true, store_slug: storeSlug }).eq('id', biz.id),
          // Tier 2: also set store_enabled — slug alone doesn't publish
          () => supabase.from('business_profiles').update({ store_enabled: true, store_slug: storeSlug }).eq('user_id', biz.user_id || biz.id),
          // Tier 3: RPC fallback
          () => supabase.rpc('publish_store', { p_biz_id: biz.id, p_slug: storeSlug }),
        ],
        { attemptsPerTier: 3, baseMs: 500, label: `StoreBuilder.publish:${biz.id}`, fallbackValue: null }
      );
      // Only mark live after server confirms — never set UI state speculatively
      if (ok === null) { Alert.alert('Error', 'Could not publish store. Please try again.'); return; }
      setStoreEnabled(true);
      Alert.alert('Published! 🎉', `Your store is live at thegruvs.app/store/${storeSlug}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <StoreSkeleton primary={primary} bg={bg} />;

  return (
    <ErrorBoundary label="Store Builder">
    <View style={{ flex: 1 }}>
      {/* Store toolbar */}
      <View style={[sbs.toolbar, { borderBottomColor: `${primary}15`, backgroundColor: `${bg}ee` }]}>
        <View style={{ flex: 1 }}>
          <TextInput
            style={[sbs.slugInput, { color: textColor, borderColor: `${primary}25` }]}
            value={slug}
            onChangeText={setSlug}
            placeholder="store-url-slug"
            placeholderTextColor={muted}
          />
        </View>
        <TouchableOpacity onPress={() => setPreviewMode(p => !p)}
          style={[sbs.toolBtn, { borderColor: `${primary}30`, backgroundColor: previewMode ? `${primary}20` : 'transparent' }]}>
          <Feather name={previewMode ? 'edit' : 'eye'} size={14} color={primary} />
          <Text style={[sbs.toolBtnText, { color: primary }]}>{previewMode ? 'Edit' : 'Preview'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={publishStore} style={[sbs.publishBtn, { backgroundColor: primary }]} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#000" /> : <>
            <Feather name="upload-cloud" size={14} color="#000" />
            <Text style={sbs.publishBtnText}>PUBLISH</Text>
          </>}
        </TouchableOpacity>
      </View>

      {/* Theme presets */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={[sbs.themesBar, { borderBottomColor: `${primary}10` }]}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingVertical: 8 }}>
        {THEME_PRESETS.map(t => (
          <TouchableOpacity key={t.id} onPress={() => setSelectedTheme(t)}
            style={[sbs.themeChip, { backgroundColor: t.bg, borderColor: selectedTheme.id === t.id ? primary : 'transparent', borderWidth: selectedTheme.id === t.id ? 2 : 1 }]}>
            <View style={[sbs.themeColor, { backgroundColor: t.primary }]} />
            <Text style={[sbs.themeLabel, { color: t.text }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {blocks.length === 0 ? (
          <GlassView style={[sbs.emptyState, { borderColor: `${primary}20` }]}>
            <Feather name="layout" size={36} color={muted} />
            <Text style={[sbs.emptyTitle, { color: textColor }]}>Your store is blank</Text>
            <Text style={[sbs.emptySub, { color: muted }]}>Add blocks to build your business storefront. Mix and match blocks to create a professional, conversion-optimised page.</Text>
          </GlassView>
        ) : blocks.map((block, i) => (
          <BlockPreviewCard
            key={block.id}
            block={block}
            primary={selectedTheme.primary}
            textColor={selectedTheme.text}
            muted={muted}
            isFirst={i === 0}
            isLast={i === blocks.length - 1}
            onEdit={() => setEditBlock(block)}
            onDelete={() => deleteBlock(block.id)}
            onMoveUp={() => moveBlock(block.id, -1)}
            onMoveDown={() => moveBlock(block.id, 1)}
          />
        ))}

        <TouchableOpacity onPress={() => setShowAddBlock(true)}
          style={[sbs.addBlockBtn, { borderColor: `${primary}40` }]} activeOpacity={0.8}>
          <Feather name="plus-circle" size={20} color={primary} />
          <Text style={[sbs.addBlockText, { color: primary }]}>ADD BLOCK</Text>
        </TouchableOpacity>
      </ScrollView>

      <AddBlockModal visible={showAddBlock} onClose={() => setShowAddBlock(false)} onAdd={addBlock} primary={primary} textColor={textColor} muted={muted} bg={bg} />

      <BlockEditorModal
        visible={!!editBlock}
        block={editBlock}
        onClose={() => setEditBlock(null)}
        onSave={(config) => saveBlock(editBlock?.id, config)}
        primary={primary} textColor={textColor} muted={muted} bg={bg}
      />
    </View>

    </ErrorBoundary>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const bps = StyleSheet.create({
  blockCard: { borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  blockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingBottom: 8 },
  blockTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  blockTypeLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  blockActions: { flexDirection: 'row', gap: 6 },
  actionBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  blockPreviewArea: { padding: 14, paddingTop: 4 },
  heroPreview: { gap: 8 },
  heroHeadline: { fontSize: 16, fontWeight: '900' },
  heroTagline: { fontSize: 12 },
  heroCta: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  textPreview: { fontSize: 12, lineHeight: 18 },
  ctaPreview: { alignItems: 'center', gap: 8 },
  ctaHeadline: { fontSize: 14, fontWeight: '800' },
  ctaBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  countdownPreview: { alignItems: 'center', gap: 8 },
  countdownLabel: { fontSize: 10 },
  countdownBlocks: { flexDirection: 'row', gap: 6 },
  countdownBlock: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  countdownNum: { fontSize: 16, fontWeight: '900' },
  countdownUnit: { fontSize: 8 },
  servicesRow: { flexDirection: 'row', gap: 10 },
  serviceCard: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  servicePrice: { fontSize: 18, fontWeight: '900' },
  serviceName: { fontSize: 11, marginTop: 4 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '900' },
  statLbl: { fontSize: 10 },
});

const bem = StyleSheet.create({
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 15, fontWeight: '900' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 10 },
  saveBtnText: { color: '#000', fontSize: 12, fontWeight: '900' },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, textAlignVertical: 'top' },
  miniInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignSelf: 'flex-start' },
  addBtnText: { fontSize: 11, fontWeight: '900' },
  listItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, marginBottom: 4 },
  alignBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
});

const abm = StyleSheet.create({
  modal: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 15, fontWeight: '900' },
  blockOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  blockOptionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  blockOptionLabel: { fontSize: 13, fontWeight: '800' },
  blockOptionDesc: { fontSize: 11, marginTop: 2 },
});

const sbs = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  slugInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  toolBtnText: { fontSize: 11, fontWeight: '800' },
  publishBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  publishBtnText: { color: '#000', fontSize: 11, fontWeight: '900' },
  themesBar: { flexGrow: 0, borderBottomWidth: 1 },
  themeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  themeColor: { width: 10, height: 10, borderRadius: 5 },
  themeLabel: { fontSize: 10, fontWeight: '700' },
  emptyState: { alignItems: 'center', padding: 40, borderRadius: 20, borderWidth: 1, gap: 12, marginBottom: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '900' },
  emptySub: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  addBlockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed' },
  addBlockText: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
});

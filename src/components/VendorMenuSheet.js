/**
 * VendorMenuSheet — displays a vendor's menu_items JSONB as a browsable sheet.
 * Used inside EventDetailScreen for food market / expo events.
 * Each menu item: { name, price, description, available }
 *
 * Usage:
 *   <VendorMenuSheet eventId={id} />          — shows all vendors
 *   <VendorMenuSheet vendorId={id} />         — single vendor
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, Image, ActivityIndicator, TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { EventCache, withCache } from '../services/offlineCache';

export const VendorMenuSheet = ({ eventId, vendorId, style }) => {
  const { colors } = useTheme();
  const primary   = colors?.primary   || "#00f2ff";
  const bg        = colors?.card      || '#111';
  const textColor = colors?.text      || '#fff';
  const muted     = colors?.muted     || 'rgba(255,255,255,0.5)';
  const surface   = colors?.surface   || "#1a1f21";

  const [vendors, setVendors]         = useState([]);
  const [selected, setSelected]       = useState(null); // open vendor
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await withCache(
      () => EventCache.getVendors(eventId || vendorId),
      () => EventCache.getVendors(eventId || vendorId),
      async () => {
        let q = supabase
          .from('event_vendors')
          .select('id, name, category, description, logo_url, stall_number, menu_items, contact, is_active')
          .eq('is_active', true)
          .order('name');
        if (eventId)  q = q.eq('event_id', eventId);
        if (vendorId) q = q.eq('id', vendorId);
        const { data } = await q;
        return data || [];
      },
      (d) => EventCache.saveVendors(eventId || vendorId, d),
    );
    setVendors(data || []);
    if (vendorId && data?.length) setSelected(data[0]);
    setLoading(false);
  }, [eventId, vendorId]);

  useEffect(() => { load(); }, [load]);

  const filteredVendors = search.trim()
    ? vendors.filter(v =>
        v.name?.toLowerCase().includes(search.toLowerCase()) ||
        v.category?.toLowerCase().includes(search.toLowerCase())
      )
    : vendors;

  if (loading) return <ActivityIndicator color={primary} style={[{ margin: 24 }, style]} />;
  if (!vendors.length) return null;

  return (
    <View style={style}>
      {/* Vendor grid */}
      {!vendorId && (
        <>
          <View style={[s.searchRow, { backgroundColor: surface, borderColor: `${primary}25` }]}>
            <Feather name="search" size={14} color={muted} />
            <TextInput
              style={[s.searchInput, { color: textColor }]}
              placeholder="Search vendors or food..."
              placeholderTextColor={muted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Feather name="x" size={14} color={muted} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
            {filteredVendors.map(v => (
              <TouchableOpacity
                key={v.id}
                style={[s.vendorCard, { backgroundColor: surface, borderColor: `${primary}25` }]}
                onPress={() => setSelected(v)}
                activeOpacity={0.8}
              >
                {v.logo_url
                  ? <Image source={{ uri: v.logo_url }} style={s.vendorLogo} />
                  : (
                    <View style={[s.vendorLogoPlaceholder, { backgroundColor: `${primary}20` }]}>
                      <Feather name="shopping-bag" size={20} color={primary} />
                    </View>
                  )
                }
                <Text style={[s.vendorName, { color: textColor }]} numberOfLines={1}>{v.name}</Text>
                {v.stall_number && <Text style={[s.stallNum, { color: primary }]}>Stall {v.stall_number}</Text>}
                {v.category && <Text style={[s.vendorCat, { color: muted }]}>{v.category}</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* Vendor detail modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={s.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setSelected(null)} />
          <View style={[s.sheet, { backgroundColor: bg }]}>
            {selected && <VendorDetail vendor={selected} primary={primary} textColor={textColor} muted={muted} surface={surface} onClose={() => setSelected(null)} />}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const VendorDetail = ({ vendor, primary, textColor, muted, surface, onClose }) => {
  const items = Array.isArray(vendor.menu_items) ? vendor.menu_items : [];
  const available = items.filter(i => i.available !== false);
  const unavailable = items.filter(i => i.available === false);

  const formatPrice = (p) => {
    if (!p && p !== 0) return '';
    if (typeof p === 'string') return p.startsWith('R') ? p : `R${p}`;
    return `R${p}`;
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={s.detailHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[s.detailName, { color: textColor }]}>{vendor.name}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            {vendor.stall_number && (
              <View style={[s.pill, { backgroundColor: `${primary}20`, borderColor: `${primary}40` }]}>
                <Text style={[s.pillText, { color: primary }]}>Stall {vendor.stall_number}</Text>
              </View>
            )}
            {vendor.category && (
              <View style={[s.pill, { backgroundColor: `${primary}10`, borderColor: `${primary}25` }]}>
                <Text style={[s.pillText, { color: primary }]}>{vendor.category}</Text>
              </View>
            )}
          </View>
          {vendor.description && (
            <Text style={[s.detailDesc, { color: muted }]}>{vendor.description}</Text>
          )}
          {vendor.contact && (
            <Text style={[s.detailContact, { color: muted }]}>📞 {vendor.contact}</Text>
          )}
        </View>
        <TouchableOpacity onPress={onClose} style={s.closeBtn}>
          <Feather name="x" size={18} color={muted} />
        </TouchableOpacity>
      </View>

      {/* Menu items */}
      {items.length > 0 && (
        <>
          <Text style={[s.menuSectionLabel, { color: primary }]}>MENU</Text>
          {available.map((item, i) => (
            <MenuItem key={i} item={item} primary={primary} textColor={textColor} muted={muted} surface={surface} formatPrice={formatPrice} />
          ))}
          {unavailable.length > 0 && (
            <>
              <Text style={[s.menuSectionLabel, { color: muted, marginTop: 12 }]}>SOLD OUT</Text>
              {unavailable.map((item, i) => (
                <MenuItem key={`u${i}`} item={item} primary={primary} textColor={muted} muted={muted} surface={surface} formatPrice={formatPrice} soldOut />
              ))}
            </>
          )}
        </>
      )}

      {!items.length && (
        <Text style={[s.emptyMenu, { color: muted }]}>No menu added yet.</Text>
      )}
    </ScrollView>
  );
};

const MenuItem = ({ item, primary, textColor, muted, surface, formatPrice, soldOut }) => (
  <View style={[s.menuItem, { backgroundColor: surface, opacity: soldOut ? 0.55 : 1 }]}>
    <View style={{ flex: 1 }}>
      <Text style={[s.itemName, { color: textColor }]}>{item.name}</Text>
      {item.description ? <Text style={[s.itemDesc, { color: muted }]} numberOfLines={2}>{item.description}</Text> : null}
    </View>
    <View style={{ alignItems: 'flex-end', gap: 4 }}>
      {item.price != null && item.price !== '' && (
        <Text style={[s.itemPrice, { color: primary }]}>{formatPrice(item.price)}</Text>
      )}
      {soldOut && <Text style={[s.soldOut, { color: muted }]}>Sold out</Text>}
    </View>
  </View>
);

const s = StyleSheet.create({
  searchRow:           { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  searchInput:         { flex: 1, fontSize: 13 },
  vendorCard:          { width: 130, borderRadius: 16, borderWidth: 1, padding: 12, alignItems: 'center', gap: 6 },
  vendorLogo:          { width: 52, height: 52, borderRadius: 26 },
  vendorLogoPlaceholder: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  vendorName:          { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  stallNum:            { fontSize: 11, fontWeight: '900' },
  vendorCat:           { fontSize: 10, textAlign: 'center' },
  overlay:             { flex: 1, justifyContent: 'flex-end' },
  sheet:               { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '88%' },
  detailHeader:        { flexDirection: 'row', gap: 12, marginBottom: 20 },
  detailName:          { fontSize: 20, fontWeight: '900' },
  detailDesc:          { fontSize: 13, marginTop: 8, lineHeight: 18 },
  detailContact:       { fontSize: 12, marginTop: 6 },
  closeBtn:            { padding: 4 },
  pill:                { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  pillText:            { fontSize: 11, fontWeight: '800' },
  menuSectionLabel:    { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
  menuItem:            { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, padding: 14, marginBottom: 8 },
  itemName:            { fontSize: 14, fontWeight: '800' },
  itemDesc:            { fontSize: 12, marginTop: 3, lineHeight: 17 },
  itemPrice:           { fontSize: 15, fontWeight: '900' },
  soldOut:             { fontSize: 10, fontWeight: '700' },
  emptyMenu:           { textAlign: 'center', fontSize: 13, paddingVertical: 24 },
});

import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput,
  TouchableOpacity, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Switch
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { useBackClose } from '../hooks/useBackClose';

const SERVICE_TYPES = ['Bakkie', 'Muscle', 'Packing', 'Full Move', 'Photography', 'DJ', 'Equipment'];

export const ProviderSetupModal = ({ visible, onClose, onSaveSuccess }) => {
  useBackClose(visible, onClose);
  const { currentTheme } = useTheme();
  const { user } = useAuth();

  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const primary = currentTheme?.primary || "#00f2ff";
  const bg = currentTheme?.background || "#0d1112";
  const textColor = currentTheme?.text || '#fff';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const surface = currentTheme?.surface || 'rgba(255,255,255,0.06)';

  useEffect(() => {
    if (visible && user) {
      loadCurrentNode();
    }
  }, [visible, user]);

  const loadCurrentNode = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from('service_nodes')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (data) {
        setServiceType(data.service_type);
        setPriceMin(String(data.price_min || ''));
        setPriceMax(String(data.price_max || ''));
        setAvailable(data.available);
      }
    } catch (e) {
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    if (!priceMin.trim() || !priceMax.trim()) {
      setError('Price range is required.');
      return;
    }
    if (!user) return;

    setLoading(true);
    setError('');

    const payload = {
      user_id: user?.id,
      service_type: serviceType,
      price_min: parseFloat(priceMin),
      price_max: parseFloat(priceMax),
      available,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error: dbError } = await supabase
        .from('service_nodes')
        .upsert(payload, { onConflict: 'user_id' });

      if (dbError) throw dbError;

      onSaveSuccess?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to save provider settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: bg, borderColor: `${primary}30` }]}>
          <View style={[s.pill, { backgroundColor: `${primary}50` }]} />

          <View style={s.header}>
            <Text style={[s.title, { color: primary }]}>PROVIDER SETTINGS</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          {fetching ? (
            <ActivityIndicator color={primary} size="large" style={{ marginVertical: 40 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <View style={s.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, { color: textColor }]}>Active & Discoverable</Text>
                  <Text style={[s.subLabel, { color: muted }]}>Show your services in the marketplace</Text>
                </View>
                <Switch
                  value={available}
                  onValueChange={setAvailable}
                  trackColor={{ false: '#333', true: primary }}
                  thumbColor="#fff"
                />
              </View>

              <Text style={[s.label, { color: muted, marginTop: 10 }]}>Service Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catBar}>
                {SERVICE_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setServiceType(t)}
                    style={[s.tag, {
                      backgroundColor: serviceType === t ? primary : `${primary}10`,
                      borderColor: serviceType === t ? primary : `${primary}20`
                    }]}
                  >
                    <Text style={{ color: serviceType === t ? '#000' : textColor, fontSize: 12, fontWeight: '700' }}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, { color: muted }]}>Min Price (R)</Text>
                  <TextInput
                    style={[s.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: surface }]}
                    placeholder="e.g. 100"
                    placeholderTextColor={muted}
                    keyboardType="numeric"
                    value={priceMin}
                    onChangeText={setPriceMin}
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, { color: muted }]}>Max Price (R)</Text>
                  <TextInput
                    style={[s.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: surface }]}
                    placeholder="e.g. 500"
                    placeholderTextColor={muted}
                    keyboardType="numeric"
                    value={priceMax}
                    onChangeText={setPriceMax}
                  />
                </View>
              </View>

              {!!error && (
                <View style={s.errorBox}>
                  <Text style={s.errorText}>⚠️ {error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: primary }]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#000" /> : <Text style={s.saveBtnText}>SAVE SETTINGS</Text>}
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.8)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, borderTopWidth: 1 },
  pill: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  subLabel: { fontSize: 10, marginBottom: 5 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.03)' },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14, marginBottom: 18 },
  catBar: { marginBottom: 20 },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  row: { flexDirection: 'row' },
  saveBtn: { paddingVertical: 16, borderRadius: 30, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.1)', padding: 12, borderRadius: 10, marginBottom: 16 },
  errorText: { color: "#ef4444", fontSize: 12, fontWeight: '600', textAlign: 'center' },
});

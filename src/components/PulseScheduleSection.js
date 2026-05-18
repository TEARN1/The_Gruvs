import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { useToast } from './ToastNotification';
import * as Haptics from 'expo-haptics';

export const PulseScheduleSection = ({ eventId, eventCategory, onAuthRequired }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  
  const [activeView, setActiveView] = useState('daily'); // 'daily' | 'monthly'
  const [requests, setRequests] = useState([]);
  const [newRequest, setNewRequest] = useState('');
  const [loading, setLoading] = useState(false);

  const primary = currentTheme?.primary || '#00f2ff';
  const bg = currentTheme?.background || '#0d1112';
  const muted = currentTheme?.textMuted || 'rgba(255,255,255,0.5)';
  const textColor = currentTheme?.text || '#fff';

  // Map category to template
  const getTemplate = () => {
    const cat = (eventCategory || '').toLowerCase();
    if (['music', 'dance', 'party', 'nightlife'].includes(cat)) return { type: 'The Jukebox', action: 'Request Song/Set', icon: 'music' };
    if (['food', 'wine', 'cooking', 'market'].includes(cat)) return { type: 'The Menu', action: 'Request Vibe Special', icon: 'coffee' };
    if (['sport', 'motorsport', 'esports', 'fitness'].includes(cat)) return { type: 'The Fixture', action: 'Request Drill/Map', icon: 'activity' };
    if (['hackathon', 'faith', 'business', 'education'].includes(cat)) return { type: 'The Forum', action: 'Request Key Topic', icon: 'message-square' };
    if (['fashion', 'arts', 'anime', 'cars'].includes(cat)) return { type: 'The Showcase', action: 'Request Feature', icon: 'star' };
    if (['mental health', 'yoga', 'parenting'].includes(cat)) return { type: 'The Focus', action: 'Vote Zen Focus', icon: 'heart' };
    if (['environment', 'property', 'pets'].includes(cat)) return { type: 'The Zone', action: 'Request Zone', icon: 'map' };
    return { type: 'The Spotlight', action: 'Request Prompt', icon: 'mic' };
  };

  const template = getTemplate();

  useEffect(() => {
    // Dummy initial data
    setRequests([
      { id: '1', content: template.type === 'The Jukebox' ? 'Amapiano Anthem X' : 'Early Session', vote_count: 12, isNow: true },
      { id: '2', content: template.type === 'The Jukebox' ? 'Deep House Mix' : 'Next Heat', vote_count: 8, isNow: false },
    ]);

    // Realtime subscription placeholder
    const channel = supabase.channel(`pulse:${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pulse_requests', filter: `event_id=eq.${eventId}` }, payload => {
         // handle live updates here
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, template.type]);

  const handleVote = (id) => {
    if (!user) return onAuthRequired();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    // Optimistic update
    setRequests(prev => prev.map(r => r.id === id ? { ...r, vote_count: r.vote_count + 1 } : r).sort((a, b) => b.vote_count - a.vote_count));
    
    // To be implemented: supabase vote insertion
  };

  const handleRequest = () => {
    if (!user) return onAuthRequired();
    if (!newRequest.trim()) return;
    
    const req = {
      id: Math.random().toString(),
      content: newRequest.trim(),
      vote_count: 1,
      isNow: false,
    };
    
    setRequests(prev => [req, ...prev].sort((a, b) => b.vote_count - a.vote_count));
    setNewRequest('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.show('Request added to the Pulse!', 'success');
  };

  return (
    <View style={[styles.container, { backgroundColor: `${primary}08`, borderColor: `${primary}20` }]}>
      <View style={styles.header}>
        <Feather name="activity" size={16} color={primary} />
        <Text style={[styles.title, { color: primary }]}>PULSE SCHEDULE</Text>
        
        <View style={styles.toggleWrap}>
          <TouchableOpacity 
            style={[styles.toggleBtn, activeView === 'daily' && { backgroundColor: primary }]} 
            onPress={() => setActiveView('daily')}
          >
            <Text style={[styles.toggleText, { color: activeView === 'daily' ? '#000' : muted }]}>Daily</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleBtn, activeView === 'monthly' && { backgroundColor: primary }]} 
            onPress={() => setActiveView('monthly')}
          >
            <Text style={[styles.toggleText, { color: activeView === 'monthly' ? '#000' : muted }]}>Monthly</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.templateInfo, { color: muted }]}>
        {template.type} Logic Active. Vote to control the frequency.
      </Text>

      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { color: textColor, borderColor: `${primary}30`, backgroundColor: `${primary}10` }]}
          placeholder={template.action}
          placeholderTextColor={muted}
          value={newRequest}
          onChangeText={setNewRequest}
          onSubmitEditing={handleRequest}
        />
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: primary }]} onPress={handleRequest}>
          <Feather name="arrow-up" size={16} color="#000" />
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {requests.map((req, i) => (
          <View key={req.id} style={[styles.reqRow, req.isNow && { borderColor: primary, borderWidth: 1, backgroundColor: `${primary}15` }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.reqContent, { color: textColor }]}>{req.content}</Text>
                {req.isNow && <View style={[styles.liveBadge, { backgroundColor: primary }]}><Text style={{ color: '#000', fontSize: 8, fontWeight: 'bold' }}>LIVE NOW</Text></View>}
              </View>
              <Text style={[styles.reqMeta, { color: muted }]}>Requested by Crew</Text>
            </View>
            
            <TouchableOpacity style={[styles.voteBtn, { backgroundColor: `${primary}20` }]} onPress={() => handleVote(req.id)}>
              <Feather name="chevron-up" size={16} color={primary} />
              <Text style={[styles.voteCount, { color: primary }]}>{req.vote_count}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    flex: 1,
  },
  toggleWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  toggleText: {
    fontSize: 10,
    fontWeight: '800',
  },
  templateInfo: {
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    fontSize: 13,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: 8,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 12,
  },
  reqContent: {
    fontSize: 14,
    fontWeight: '700',
  },
  reqMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  liveBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  voteCount: {
    fontSize: 13,
    fontWeight: '900',
  },
});

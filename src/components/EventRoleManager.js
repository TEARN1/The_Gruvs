/**
 * EventRoleManager — bottom-sheet panel for the event organiser to grant/revoke
 * co-host, moderator, scanner, and VIP-manager roles to attendees.
 *
 * Shown via a "Manage Team" button in EventDetailScreen (organiser-only).
 * Fetches RSVPs going to show candidates, shows current role holders, and
 * handles invite + notification in one RPC call.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Modal, ActivityIndicator, Image, Animated,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { invalidateEventRoleCache } from '../hooks/useEventRole';

const ROLES = [
  { key: 'co_host',     icon: 'star',    color: "#f59e0b", label: 'Co-Host',     desc: 'Full management access' },
  { key: 'moderator',   icon: 'shield',  color: "#3b82f6", label: 'Moderator',   desc: 'Manage chat & check-ins' },
  { key: 'scanner',     icon: 'scan',    color: "#10b981", label: 'Scanner',     desc: 'Scan tickets at the door' },
  { key: 'vip_manager', icon: 'award',   color: "#8b5cf6", label: 'VIP Manager', desc: 'Approve VIP bookings' },
];

const RoleBadge = ({ role, size = 'sm', style }) => {
  const r = ROLES.find(x => x.key === role);
  if (!r) return null;
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', gap: 3,
      paddingHorizontal: size === 'sm' ? 6 : 8,
      paddingVertical: size === 'sm' ? 2 : 4,
      borderRadius: 8,
      backgroundColor: `${r.color}20`,
      borderWidth: 1, borderColor: `${r.color}50`,
    }, style]}>
      <Feather name={r.icon} size={size === 'sm' ? 9 : 11} color={r.color} />
      <Text style={{ color: r.color, fontSize: size === 'sm' ? 9 : 11, fontWeight: '800', letterSpacing: 0.3 }}>
        {r.label.toUpperCase()}
      </Text>
    </View>
  );
};

const MemberRow = React.memo(({ item, onRevoke, primary, textColor, muted, surface }) => {
  const r = ROLES.find(x => x.key === item.role);
  return (
    <View style={[rm.memberRow, { backgroundColor: surface, borderColor: `${r?.color || primary}20` }]}>
      <View style={[rm.avatar, { backgroundColor: `${r?.color || primary}20` }]}>
        {item.profiles?.avatar_url
          ? <Image source={{ uri: item.profiles.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
          : <Text style={{ color: r?.color || primary, fontWeight: '900', fontSize: 14 }}>
              {(item.profiles?.username || 'U')[0].toUpperCase()}
            </Text>
        }
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: textColor, fontWeight: '700', fontSize: 13 }}>
          @{item.profiles?.username || 'unknown'}
        </Text>
        <RoleBadge role={item.role} size="sm" style={{ alignSelf: 'flex-start', marginTop: 3 }} />
      </View>
      <TouchableOpacity
        style={[rm.revokeBtn, { borderColor: '#ef444440' }]}
        onPress={() => onRevoke(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="x" size={14} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
});

const AttendeeRow = React.memo(({ item, onGrant, primary, textColor, muted, surface }) => (
  <TouchableOpacity
    style={[rm.attendeeRow, { backgroundColor: surface, borderColor: `${primary}15` }]}
    onPress={() => onGrant(item)}
    activeOpacity={0.8}
  >
    <View style={[rm.avatar, { backgroundColor: `${primary}20` }]}>
      {item.profiles?.avatar_url
        ? <Image source={{ uri: item.profiles.avatar_url }} style={{ width: 32, height: 32, borderRadius: 16 }} />
        : <Text style={{ color: primary, fontWeight: '900', fontSize: 12 }}>
            {(item.profiles?.username || 'U')[0].toUpperCase()}
          </Text>
      }
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{ color: textColor, fontWeight: '600', fontSize: 12 }}>@{item.profiles?.username}</Text>
      {item.profiles?.city && (
        <Text style={{ color: muted, fontSize: 10 }}>{item.profiles.city}</Text>
      )}
    </View>
    <View style={[rm.grantBtn, { backgroundColor: `${primary}15`, borderColor: `${primary}40` }]}>
      <Feather name="plus" size={12} color={primary} />
      <Text style={{ color: primary, fontSize: 11, fontWeight: '700' }}>Assign</Text>
    </View>
  </TouchableOpacity>
));

export const EventRoleManager = ({ visible, onClose, event, primary, textColor, muted, surface, bg }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [currentRoles, setCurrentRoles] = useState([]);
  const [attendees, setAttendees]       = useState([]);
  const [search, setSearch]             = useState('');
  const [loading, setLoading]           = useState(true);
  const [assigning, setAssigning]       = useState(null); // userId being assigned
  const [pickerTarget, setPickerTarget] = useState(null); // { profile } for role picker

  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
      fetchData();
    } else {
      Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  const fetchData = useCallback(async () => {
    if (!event?.id) return;
    setLoading(true);
    try {
      const [rolesRes, attendeesRes] = await Promise.all([
        supabase
          .from('event_roles')
          .select('*, profiles(id, username, avatar_url, city)')
          .eq('event_id', event.id),
        supabase
          .from('event_rsvps')
          .select('user_id, profiles(id, username, avatar_url, city)')
          .eq('event_id', event.id)
          .eq('status', 'going')
          .neq('user_id', event.author_id)
          .limit(50),
      ]);

      const roleUserIds = new Set((rolesRes.data || []).map(r => r.user_id));
      setCurrentRoles(rolesRes.data || []);
      setAttendees((attendeesRes.data || []).filter(a => !roleUserIds.has(a.user_id)));
    } catch (e) {
      showToast('Could not load team data', 'error');
    } finally {
      setLoading(false);
    }
  }, [event?.id]);

  const handleRevoke = async (roleRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await supabase
      .from('event_roles')
      .delete()
      .eq('id', roleRow.id);

    if (error) { showToast('Could not revoke role', 'error'); return; }
    invalidateEventRoleCache(event.id);
    showToast(`Role revoked from @${roleRow.profiles?.username}`, 'success');
    fetchData();
  };

  const handleGrantRole = async (targetProfile, role) => {
    if (!role) return;
    setAssigning(targetProfile.id);
    setPickerTarget(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const { error } = await supabase.from('event_roles').insert({
        event_id:   event.id,
        user_id:    targetProfile.id,
        role,
        granted_by: user?.id,
      });
      if (error) throw error;

      // Notify the invitee via activity_feed
      await supabase.rpc('notify_cohost_invite', {
        p_event_id:    event.id,
        p_invitee_id:  targetProfile.id,
        p_inviter_id: user?.id,
        p_event_title: event.title,
      });

      invalidateEventRoleCache(event.id);
      const roleDef = ROLES.find(r => r.key === role);
      showToast(`@${targetProfile.username} is now ${roleDef?.label}! 🎉`, 'success');
      fetchData();
    } catch (e) {
      showToast(e.message || 'Could not assign role', 'error');
    } finally {
      setAssigning(null);
    }
  };

  const filteredAttendees = attendees.filter(a =>
    !search.trim() || a.profiles?.username?.toLowerCase().includes(search.toLowerCase())
  );

  const p = primary || "#00f2ff";
  const tc = textColor || '#fff';
  const mu = muted || 'rgba(255,255,255,0.5)';
  const su = surface || "#1a1f21";
  const bk = bg || "#0d1112";

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={rm.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={rm.kavWrapper}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[rm.sheet, { backgroundColor: bk, transform: [{ translateY: slideAnim }] }]}
        >
          {/* Handle */}
          <View style={[rm.handle, { backgroundColor: `${p}40` }]} />

          {/* Header */}
          <View style={rm.header}>
            <View>
              <Text style={[rm.title, { color: tc }]}>Manage Team</Text>
              <Text style={[rm.sub, { color: mu }]}>{event?.title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[rm.closeBtn, { borderColor: `${p}30` }]}>
              <Feather name="x" size={18} color={mu} />
            </TouchableOpacity>
          </View>

          {/* Role legend */}
          <View style={rm.legendRow}>
            {ROLES.map(r => (
              <View key={r.key} style={[rm.legendItem, { backgroundColor: `${r.color}12`, borderColor: `${r.color}30` }]}>
                <Feather name={r.icon} size={11} color={r.color} />
                <Text style={{ color: r.color, fontSize: 9, fontWeight: '800' }}>{r.label.toUpperCase()}</Text>
              </View>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color={p} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={null}
              ListHeaderComponent={
                <>
                  {/* Current team */}
                  {currentRoles.length > 0 && (
                    <>
                      <Text style={[rm.sectionLabel, { color: mu }]}>CURRENT TEAM ({currentRoles.length})</Text>
                      {currentRoles.map(r => (
                        <MemberRow
                          key={r.id} item={r} onRevoke={handleRevoke}
                          primary={p} textColor={tc} muted={mu} surface={su}
                        />
                      ))}
                    </>
                  )}

                  {/* Search attendees */}
                  <Text style={[rm.sectionLabel, { color: mu, marginTop: 16 }]}>ADD FROM ATTENDEES</Text>
                  <View style={[rm.searchBar, { backgroundColor: su, borderColor: `${p}25` }]}>
                    <Feather name="search" size={14} color={mu} />
                    <TextInput
                      style={[rm.searchInput, { color: tc }]}
                      placeholder="Search by username..."
                      placeholderTextColor={mu}
                      value={search}
                      onChangeText={setSearch}
                      autoCapitalize="none"
                    />
                    {search.length > 0 && (
                      <TouchableOpacity onPress={() => setSearch('')}>
                        <Feather name="x" size={13} color={mu} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {filteredAttendees.length === 0 && (
                    <Text style={[rm.emptyText, { color: mu }]}>
                      {search ? 'No attendees match your search.' : 'No going attendees yet.'}
                    </Text>
                  )}
                </>
              }
              renderItem={null}
              ListFooterComponent={
                <>
                  {filteredAttendees.map(a => (
                    <AttendeeRow
                      key={a.user_id} item={a}
                      onGrant={(item) => setPickerTarget(item.profiles)}
                      primary={p} textColor={tc} muted={mu} surface={su}
                    />
                  ))}
                  <View style={{ height: 40 }} />
                </>
              }
              keyExtractor={(_, i) => String(i)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          )}
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Role picker overlay */}
      {pickerTarget && (
        <Modal transparent animationType="fade" onRequestClose={() => setPickerTarget(null)}>
          <TouchableOpacity style={rm.backdrop} activeOpacity={1} onPress={() => setPickerTarget(null)} />
          <View style={[rm.rolePicker, { backgroundColor: bk, borderColor: `${p}25` }]}>
            <Text style={[rm.rolePickerTitle, { color: tc }]}>
              Assign role to @{pickerTarget.username}
            </Text>
            {ROLES.map(r => (
              <TouchableOpacity
                key={r.key}
                style={[rm.roleOption, { backgroundColor: `${r.color}12`, borderColor: `${r.color}35` }]}
                onPress={() => handleGrantRole(pickerTarget, r.key)}
                disabled={!!assigning}
              >
                <View style={[rm.roleIcon, { backgroundColor: `${r.color}25` }]}>
                  <Feather name={r.icon} size={16} color={r.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: r.color, fontWeight: '800', fontSize: 14 }}>{r.label}</Text>
                  <Text style={{ color: mu, fontSize: 11 }}>{r.desc}</Text>
                </View>
                {assigning === pickerTarget.id
                  ? <ActivityIndicator size="small" color={r.color} />
                  : <Feather name="chevron-right" size={16} color={r.color} />
                }
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setPickerTarget(null)} style={rm.cancelBtn}>
              <Text style={{ color: mu, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </Modal>
  );
};

// Export the role badge for reuse across the app
export { RoleBadge };

const rm = StyleSheet.create({
  backdrop:        { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  kavWrapper:      { flex: 1, justifyContent: 'flex-end' },
  sheet:           { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingTop: 10 },
  handle:          { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  title:           { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  sub:             { fontSize: 12, marginTop: 2 },
  closeBtn:        { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  legendRow:       { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 12, flexWrap: 'wrap' },
  legendItem:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  sectionLabel:    { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  memberRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 6 },
  attendeeRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 6 },
  avatar:          { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  revokeBtn:       { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  grantBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  searchBar:       { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  searchInput:     { flex: 1, fontSize: 13, fontWeight: '500' },
  emptyText:       { textAlign: 'center', fontSize: 13, paddingVertical: 20 },
  rolePicker:      { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 20, gap: 10 },
  rolePickerTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  roleOption:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  roleIcon:        { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cancelBtn:       { alignItems: 'center', paddingVertical: 14 },
});

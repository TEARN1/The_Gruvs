/**
 * VerifiedRequestCard — the user-facing end of the Verified engine (A2).
 *
 * Lives in Profile → Powers & Standing. Three states:
 *   • already verified → nothing (the tick speaks for itself)
 *   • application pending / recently reviewed → status line
 *   • otherwise → live criteria checklist + APPLY when every box is green
 *     (the server re-checks everything in request_verification()).
 *
 * Schema-tolerant: before verification_engine.sql is applied, the RPC errors
 * and the card just shows the checklist without the apply path breaking.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { AnalyticsManager } from '../services/dataFlow';
import { verificationChecklist } from '../utils/verificationCriteria';
import { useToast } from './ToastNotification';

const GREEN = '#10b981';

export const VerifiedRequestCard = ({ primary = '#00f2ff', surface = '#131a1c', textColor = '#fff', muted = 'rgba(255,255,255,0.55)' }) => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [touchDowns, setTouchDowns] = useState(0);
  const [request, setRequest] = useState(null);   // latest application, if any
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const stats = await AnalyticsManager.getProfileStats(user.id);
      setTouchDowns(stats?.touchDownCount || 0);
    } catch {}
    try {
      const { data } = await supabase
        .from('verification_requests')
        .select('id, status, created_at, reviewed_at, review_note')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setRequest(data || null);
    } catch { /* table not deployed yet — checklist still renders */ }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  if (!user || profile?.is_verified) return null;

  const { checks, eligible } = verificationChecklist(profile, touchDowns);

  const apply = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc('request_verification', { p_note: null });
      if (error) {
        const msg = error.message || '';
        if (/does not exist|schema cache/i.test(msg)) showToast('Verification opens soon — keep building.', 'info');
        else showToast(msg.replace(/^.*?: /, ''), 'error'); // server states the exact unmet rule
      } else {
        showToast('Application sent — a human will review it. ✓', 'success');
        load();
      }
    } catch { showToast('Could not apply. Try again.', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <View style={[vc.card, { backgroundColor: surface, borderColor: `${GREEN}30` }]}>
      <View style={vc.headRow}>
        <Feather name="check-circle" size={14} color={GREEN} />
        <Text style={[vc.head, { color: textColor }]}>Get Verified</Text>
        <Text style={[vc.earned, { color: muted }]}>earned only — never for sale</Text>
      </View>

      {request?.status === 'pending' ? (
        <Text style={[vc.status, { color: '#f59e0b' }]}>
          <Feather name="clock" size={11} color="#f59e0b" /> Application under review — a human checks every one.
        </Text>
      ) : (
        <>
          {request?.status === 'rejected' && (
            <Text style={[vc.status, { color: muted }]} numberOfLines={2}>
              Last application wasn't approved{request.review_note ? ` — ${request.review_note}` : ''}. You can re-apply 30 days after review.
            </Text>
          )}
          {checks.map(c => (
            <View key={c.key} style={vc.checkRow}>
              <Feather name={c.ok ? 'check-circle' : 'circle'} size={12} color={c.ok ? GREEN : muted} />
              <Text style={[vc.checkText, { color: c.ok ? textColor : muted }]} numberOfLines={1}>
                {c.label}{!c.ok ? `  (${c.have}/${c.need})` : ''}
              </Text>
            </View>
          ))}
          <TouchableOpacity
            style={[vc.applyBtn, { backgroundColor: eligible ? GREEN : 'rgba(255,255,255,0.08)' }]}
            disabled={!eligible || busy}
            onPress={apply}
          >
            <Text style={{ color: eligible ? '#000' : muted, fontWeight: '900', fontSize: 12 }}>
              {eligible ? (busy ? 'SENDING…' : 'APPLY FOR VERIFICATION') : 'KEEP BUILDING — REAL PRESENCE COUNTS'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const vc = StyleSheet.create({
  card:     { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  headRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  head:     { fontSize: 13, fontWeight: '900', flex: 1 },
  earned:   { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  status:   { fontSize: 11, fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkText:{ fontSize: 11, fontWeight: '600', flex: 1 },
  applyBtn: { alignItems: 'center', paddingVertical: 10, borderRadius: 10, marginTop: 4 },
});

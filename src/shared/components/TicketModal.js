import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ACCENT, GOLD, THEME } from '../../core/theme';
import { useStore } from '../../core/state/useStore';
import { useNavigation } from '@react-navigation/native';

export default function TicketModal({ visible, onClose, event }) {
  const { user } = useStore();
  const navigation = useNavigation();
  const [mode, setMode] = useState('ticket'); // 'ticket' | 'bid'
  const [ticketCount, setTicketCount] = useState(1);
  const [bidAmount, setBidAmount] = useState(5000); // Base ZAR 5000 for VIP Table

  const handleCheckout = () => {
    if (!user || user.isVisitor) {
      onClose();
      navigation.navigate('Auth');
      return;
    }
    // Mock Apple Pay / Google Pay / Native Checkout flow
    alert(mode === 'bid' ? `VIP Bid of R${bidAmount} placed securely.` : `Purchased ${ticketCount} ticket(s) via Apple Pay.`);
    onClose();
  };

  if (!event) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      
      <View style={styles.sheet}>
        <View style={styles.handle} />
        
        <View style={styles.header}>
          <Text style={styles.eventTitle}>{event.content?.title || 'Exclusive Event'}</Text>
          <Text style={styles.eventVenue}>{event.content?.location || 'Unknown'}</Text>
        </View>

        <View style={styles.modeToggle}>
          <TouchableOpacity style={[styles.modeBtn, mode === 'ticket' && styles.modeBtnActive]} onPress={() => setMode('ticket')}>
            <Text style={[styles.modeText, mode === 'ticket' && styles.modeTextActive]}>Standard Entry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeBtn, mode === 'bid' && styles.modeBtnActiveGold]} onPress={() => setMode('bid')}>
            <MaterialCommunityIcons name="crown" size={14} color={mode === 'bid' ? '#000' : GOLD} />
            <Text style={[styles.modeText, mode === 'bid' && styles.modeTextActiveGold]}>Bid VIP Table</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {mode === 'ticket' ? (
            <View style={styles.section}>
              <View style={styles.ticketRow}>
                <View>
                  <Text style={styles.ticketType}>General Access</Text>
                  <Text style={styles.ticketPrice}>R250.00 <Text style={styles.feeText}>+ R15.00 App Fee</Text></Text>
                </View>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setTicketCount(Math.max(1, ticketCount - 1))}>
                    <Ionicons name="remove" size={18} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.stepCount}>{ticketCount}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setTicketCount(ticketCount + 1)}>
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>R{(265 * ticketCount).toFixed(2)}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.bidNotice}>
                <Ionicons name="information-circle" size={16} color={GOLD} />
                <Text style={styles.bidNoticeText}>Highest 5 bidders secure a private VIP balcony table.</Text>
              </View>
              <View style={styles.bidControls}>
                <Text style={styles.bidLabel}>Your Bid (ZAR)</Text>
                <View style={styles.bidInputWrapper}>
                  <Text style={styles.currencySymbol}>R</Text>
                  <Text style={styles.bidValue}>{bidAmount.toLocaleString()}</Text>
                </View>
                <View style={styles.bidStepper}>
                  <TouchableOpacity style={styles.bidStepBtn} onPress={() => setBidAmount(Math.max(1000, bidAmount - 500))}>
                    <Text style={styles.bidStepText}>- R500</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.bidStepBtn} onPress={() => setBidAmount(bidAmount + 500)}>
                    <Text style={styles.bidStepText}>+ R500</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Current Top Bid</Text>
                <Text style={[styles.totalValue, { color: GOLD }]}>R12,500</Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={[styles.payBtn, mode === 'bid' && styles.payBtnGold]} onPress={handleCheckout}>
            <Ionicons name={Platform.OS === 'ios' ? 'logo-apple' : 'card'} size={20} color={mode === 'bid' ? '#000' : '#fff'} />
            <Text style={[styles.payBtnText, mode === 'bid' && { color: '#000' }]}>
              {mode === 'bid' ? 'Place Secure Bid' : `Pay R${(265 * ticketCount).toFixed(2)}`}
            </Text>
          </TouchableOpacity>
          <Text style={styles.secureText}>
            <Ionicons name="lock-closed" size={11} color="#94a3b8" /> Secured by Enterprise Firewall
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0a0a1e', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, maxHeight: '90%', borderWidth: 1, borderColor: '#1a1a3e' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#2a2a4a', alignSelf: 'center', marginBottom: 20 },
  
  header: { marginBottom: 20, alignItems: 'center' },
  eventTitle: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  eventVenue: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  
  modeToggle: { flexDirection: 'row', backgroundColor: '#0d0d25', borderRadius: 12, padding: 4, marginBottom: 24, borderWidth: 1, borderColor: '#1e1e3f' },
  modeBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: 10, gap: 6 },
  modeBtnActive: { backgroundColor: '#1a1a3e' },
  modeText: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },
  modeTextActive: { color: '#fff' },
  modeBtnActiveGold: { backgroundColor: GOLD },
  modeTextActiveGold: { color: '#000' },
  
  section: { marginBottom: 20 },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0d0d25', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#1e1e3f', marginBottom: 16 },
  ticketType: { color: '#fff', fontSize: 16, fontWeight: '800' },
  ticketPrice: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
  feeText: { fontSize: 11, color: '#55608a' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#1a1a3e', borderRadius: 25, paddingHorizontal: 6, paddingVertical: 4 },
  stepBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#2a2a4a', justifyContent: 'center', alignItems: 'center' },
  stepCount: { color: '#fff', fontSize: 16, fontWeight: '800' },
  
  bidNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,215,0,0.1)', padding: 12, borderRadius: 12, marginBottom: 20 },
  bidNoticeText: { color: GOLD, fontSize: 12, flex: 1, fontWeight: '600' },
  bidControls: { alignItems: 'center', marginBottom: 20 },
  bidLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  bidInputWrapper: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  currencySymbol: { color: GOLD, fontSize: 24, fontWeight: '900' },
  bidValue: { color: '#fff', fontSize: 48, fontWeight: '900', letterSpacing: -1 },
  bidStepper: { flexDirection: 'row', gap: 12, marginTop: 20 },
  bidStepBtn: { backgroundColor: '#1a1a3e', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  bidStepText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1a1a3e', paddingTop: 16 },
  totalLabel: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
  totalValue: { color: '#fff', fontSize: 24, fontWeight: '900' },
  
  payBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 10, 
    backgroundColor: '#fff', 
    paddingVertical: 18, 
    borderRadius: 16,
    ...Platform.select({
      web: { boxShadow: '0 8px 10px rgba(0,0,0,0.2)' },
      default: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 }
    })
  },
  payBtnGold: { 
    backgroundColor: GOLD,
    ...Platform.select({
      web: { boxShadow: `0 8px 10px ${GOLD}66` },
      default: { shadowColor: GOLD, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 }
    })
  },
  payBtnText: { color: '#000', fontSize: 16, fontWeight: '900' },
  secureText: { color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 14, fontWeight: '600' }
});

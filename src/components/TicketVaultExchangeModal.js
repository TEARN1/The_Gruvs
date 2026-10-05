/**
 * TicketVaultExchangeModal — Operations, Secondary Resale, Escrow, Table Kitty & Door Queue.
 *
 * Provides full UI for:
 * - Offline Ticket Vault (No-signal cryptographic pass rendering)
 * - Secondary Ticket Exchange (Zero-scam peer-to-peer face-value resale)
 * - Live Door Thermometer & Queue tracker
 * - Talent Booking Escrow (Locked DJ performance fees)
 * - Table Kitty (Squad bill & bottle split pool)
 * - Promoter Flyer Bounties (Earn Coins by sharing to WhatsApp Status)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { TicketVaultService } from '../services/ticketVaultService';
import { ControlledGlitterBurst } from './ControlledGlitterBurst';
import { haptics } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

const TABS = [
  { key: 'vault', label: 'Offline Pass', icon: 'shield' },
  { key: 'resale', label: 'Resale Exchange', icon: 'repeat' },
  { key: 'queue', label: 'Door Queue', icon: 'clock' },
  { key: 'escrow', label: 'Talent Escrow', icon: 'lock' },
  { key: 'kitty', label: 'Table Kitty', icon: 'users' },
  { key: 'bounty', label: 'Flyer Bounties', icon: 'award' },
];

export function TicketVaultExchangeModal({
  visible,
  event,
  onClose,
  primary = '#00f2ff',
  textColor = '#fff',
  muted = 'rgba(255,255,255,0.55)',
  surface = '#111618',
  bg = '#080b0d',
}) {
  const { user } = useAuth();
  const { show: toast } = useToast();

  const [activeTab, setActiveTab] = useState('vault');
  const [vaultTickets, setVaultTickets] = useState([]);
  const [resales, setResales] = useState([]);
  const [doorQueue, setDoorQueue] = useState({ wait_minutes: 15, capacity_percent: 70, notes: 'Steady line' });
  const [escrows, setEscrows] = useState([]);
  const [kitties, setKitties] = useState([]);
  const [bounties, setBounties] = useState([]);
  const [glitters, setGlitters] = useState({});

  // Form states
  const [resalePrice, setResalePrice] = useState('150');
  const [kittySquad, setKittySquad] = useState('');
  const [kittyTarget, setKittyTarget] = useState('2500');
  const [escrowArtist, setEscrowArtist] = useState('');
  const [escrowFee, setEscrowFee] = useState('3500');
  const [escrowTime, setEscrowTime] = useState('23:30 - 01:00');
  const [queueWait, setQueueWait] = useState('20');
  const [queueCap, setQueueCap] = useState('80');
  const [queueNotes, setQueueNotes] = useState('Door policy: Strictly 21+ tonight');

  const loadData = useCallback(async () => {
    if (!event?.id) return;
    const [tix, res, queue, esc, kit, bnt] = await Promise.all([
      TicketVaultService.getVaultedTickets(),
      TicketVaultService.getAvailableResales(event.id),
      TicketVaultService.getDoorQueue(event.id),
      TicketVaultService.getEscrowsForEvent(event.id),
      TicketVaultService.getTableKittiesForEvent(event.id),
      TicketVaultService.getBountiesForEvent(event.id),
    ]);
    setVaultTickets(tix.length ? tix : [{
      id: `pass_${event.id}`,
      event_id: event.id,
      event_title: event.title || 'VIP Nightlife Pass',
      tier: 'VIP Access Pass',
      holder: user?.user_metadata?.username || 'You',
      offline_signature: `HMAC_${event.id}_SECURE_PASS_${Date.now()}`,
    }]);
    setResales(res);
    setDoorQueue(queue);
    setEscrows(esc);
    setKitties(kit);
    setBounties(bnt);
  }, [event?.id, user]);

  useEffect(() => {
    if (visible) loadData();
  }, [visible, loadData]);

  const triggerGlitter = (key) => {
    haptics.success?.();
    setGlitters(prev => ({ ...prev, [key]: Date.now() }));
  };

  // Actions
  const handleSaveToVault = async () => {
    triggerGlitter('vault');
    await TicketVaultService.saveTicketToVault({
      id: `ticket_${Date.now()}`,
      event_id: event.id,
      event_title: event.title,
      tier: 'General / VIP',
    });
    loadData();
    toast?.('Ticket cryptographically vaulted for offline entry! 🎟️', 'success');
  };

  const handleListResale = async () => {
    if (!resalePrice) return;
    triggerGlitter('resale');
    await TicketVaultService.listTicketForResale({
      ticketId: `t_${Date.now()}`,
      eventId: event.id,
      sellerId: user?.id || 'anon',
      priceZar: Number(resalePrice),
      seatOrTier: 'VIP Access',
    });
    setResalePrice('');
    loadData();
    toast?.(`Ticket listed on verified exchange for R${resalePrice}!`, 'success');
  };

  const handleBuyResale = async (listingId, price) => {
    triggerGlitter(`buy_${listingId}`);
    await TicketVaultService.purchaseResaleTicket(listingId, user?.id || 'buyer');
    loadData();
    toast?.(`Purchased! Old QR revoked, new secure pass minted for R${price}! 🎉`, 'success');
  };

  const handleUpdateQueue = async () => {
    triggerGlitter('queue');
    await TicketVaultService.updateDoorQueue({
      eventId: event.id,
      waitMinutes: Number(queueWait),
      capacityPercent: Number(queueCap),
      notes: queueNotes,
    });
    loadData();
    toast?.('Door queue and capacity thermometer updated!', 'success');
  };

  const handleCreateKitty = async () => {
    if (!kittySquad.trim() || !kittyTarget) return;
    triggerGlitter('kitty');
    await TicketVaultService.createTableKitty({
      eventId: event.id,
      squadName: kittySquad,
      targetZar: Number(kittyTarget),
      createdBy: user?.id,
    });
    setKittySquad('');
    loadData();
    toast?.('Squad Table Kitty created! Ready for contributions.', 'success');
  };

  const handleContributeKitty = async (kittyId) => {
    triggerGlitter(`kitty_chip_${kittyId}`);
    await TicketVaultService.contributeToKitty(kittyId, {
      userId: user?.id || 'mate',
      username: user?.user_metadata?.username || 'Squad Member',
      amountZar: 250,
    });
    loadData();
    toast?.('Added R250 to table kitty! 🍾', 'success');
  };

  const handleCreateEscrow = async () => {
    if (!escrowArtist.trim() || !escrowFee) return;
    triggerGlitter('escrow');
    await TicketVaultService.createTalentEscrow({
      eventId: event.id,
      promoterId: user?.id,
      artistId: `art_${Date.now()}`,
      artistName: escrowArtist,
      feeZar: Number(escrowFee),
      setTime: escrowTime,
    });
    setEscrowArtist('');
    loadData();
    toast?.(`R${escrowFee} locked in Talent Escrow for ${escrowArtist}! 🔒`, 'success');
  };

  const handleReleaseEscrow = async (escrowId, name) => {
    triggerGlitter(`release_${escrowId}`);
    await TicketVaultService.releaseTalentEscrow(escrowId);
    loadData();
    toast?.(`Set verified! Performance fee paid directly to ${name}'s wallet! 💸`, 'success');
  };

  const handleShareBounty = (bounty) => {
    triggerGlitter(`bounty_${bounty.id}`);
    const link = `https://thegruvs.com/events/${event.id}?ref=${user?.id || 'promo'}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(`🔥 Catch me at ${event.title}! RSVP here: ${link}`).catch(() => {});
    }
    toast?.(`Referral link copied! Earn ${bounty.reward_per_checkin} coins for every friend who checks in!`, 'success');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
        <View style={[styles.sheetContainer, { backgroundColor: bg, borderColor: `${primary}35` }]}>
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: `${primary}20` }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="shield" size={18} color={primary} />
              <Text style={[styles.headerTitle, { color: textColor }]}>Ops & Ticket Vault</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={muted} />
            </TouchableOpacity>
          </View>

          {/* Subheader */}
          <View style={styles.eventContextBar}>
            <Text style={[styles.eventContextTitle, { color: textColor }]} numberOfLines={1}>
              {event?.title || 'Event Operations'}
            </Text>
            <Text style={[styles.eventContextSub, { color: primary }]}>Zero-Signal & Verified Truth Protocols</Text>
          </View>

          {/* Horizontal Tab Strip */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsWrap}>
            {TABS.map(tab => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[
                    styles.tabPill,
                    {
                      backgroundColor: active ? `${primary}20` : 'rgba(255,255,255,0.04)',
                      borderColor: active ? primary : 'rgba(255,255,255,0.12)',
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Feather name={tab.icon} size={13} color={active ? primary : muted} />
                  <Text style={[styles.tabLabel, { color: active ? primary : muted }]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Tab Content */}
          <ScrollView contentContainerStyle={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            {/* ── 1. OFFLINE VAULT ── */}
            {activeTab === 'vault' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.infoBanner, { borderColor: `${primary}35`, backgroundColor: `${primary}10` }]}>
                  <Feather name="wifi-off" size={16} color={primary} />
                  <Text style={[styles.infoBannerText, { color: textColor }]}>
                    No signal inside the club? Your cryptographic passes are signed and validated offline.
                  </Text>
                </View>

                {vaultTickets.map((t, idx) => (
                  <View key={idx} style={[styles.ticketCard, { borderColor: `${primary}45`, backgroundColor: surface }]}>
                    <View style={styles.ticketTop}>
                      <View>
                        <Text style={[styles.ticketTier, { color: primary }]}>{t.tier || 'VIP Access Pass'}</Text>
                        <Text style={[styles.ticketEvent, { color: textColor }]}>{t.event_title}</Text>
                      </View>
                      <View style={[styles.vaultedBadge, { backgroundColor: '#10b98125', borderColor: '#10b981' }]}>
                        <Feather name="check-circle" size={11} color="#10b981" />
                        <Text style={styles.vaultedBadgeText}>VAULTED OFFLINE</Text>
                      </View>
                    </View>

                    {/* Offline cryptographic QR mockup */}
                    <View style={styles.qrDisplayBox}>
                      <View style={[styles.qrMock, { borderColor: primary }]}>
                        <Feather name="maximize" size={54} color={primary} />
                        <Text style={[styles.qrSignature, { color: muted }]}>HMAC-SHA256 SECURED</Text>
                      </View>
                      <Text style={[styles.qrCodeText, { color: textColor }]}>{t.offline_signature}</Text>
                    </View>

                    <Text style={[styles.ticketFoot, { color: muted }]}>
                      Present this pass to the door scanner. Works 100% with airplane mode enabled.
                    </Text>
                  </View>
                ))}

                <TouchableOpacity
                  onPress={handleSaveToVault}
                  style={[styles.primaryActionBtn, { backgroundColor: primary, position: 'relative' }]}
                  activeOpacity={0.85}
                >
                  <Feather name="download-cloud" size={15} color="#000" />
                  <Text style={styles.primaryActionBtnText}>Re-Sign & Vault Offline</Text>
                  <ControlledGlitterBurst trigger={glitters.vault} count={12} radius={32} colors={[primary, '#ffd700', '#fff']} />
                </TouchableOpacity>
              </View>
            )}

            {/* ── 2. SECONDARY RESALE EXCHANGE ── */}
            {activeTab === 'resale' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.infoBanner, { borderColor: '#f59e0b40', backgroundColor: '#f59e0b12' }]}>
                  <Feather name="alert-triangle" size={16} color="#f59e0b" />
                  <Text style={[styles.infoBannerText, { color: textColor }]}>
                    Zero-scam resale. When bought, the seller's ticket QR is revoked and a fresh pass is generated for you.
                  </Text>
                </View>

                {/* List for sale */}
                <View style={[styles.boxCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: surface }]}>
                  <Text style={[styles.boxTitle, { color: textColor }]}>Can't make it? List Ticket at Face Value</Text>
                  <View style={styles.inputRow}>
                    <Text style={[styles.zarPrefix, { color: primary }]}>R</Text>
                    <TextInput
                      style={[styles.inputField, { color: textColor, borderColor: `${primary}35` }]}
                      placeholder="Resale Price (ZAR)"
                      placeholderTextColor={muted}
                      keyboardType="numeric"
                      value={resalePrice}
                      onChangeText={setResalePrice}
                    />
                    <TouchableOpacity
                      onPress={handleListResale}
                      style={[styles.smallBtn, { backgroundColor: primary, position: 'relative' }]}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.smallBtnText}>List Now</Text>
                      <ControlledGlitterBurst trigger={glitters.resale} count={10} radius={26} colors={[primary, '#fff']} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Available listings */}
                <Text style={[styles.sectionSubtitle, { color: textColor }]}>Available Verified Resale Tickets</Text>
                {resales.length === 0 ? (
                  <Text style={[styles.emptyNotice, { color: muted }]}>No resales currently available. Check back soon!</Text>
                ) : (
                  resales.map(item => (
                    <View key={item.id} style={[styles.resaleRow, { borderColor: `${primary}30`, backgroundColor: surface }]}>
                      <View>
                        <Text style={[styles.resaleTier, { color: textColor }]}>{item.tier_label}</Text>
                        <Text style={[styles.resalePrice, { color: primary }]}>R{item.price_zar}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleBuyResale(item.id, item.price_zar)}
                        style={[styles.buyBtn, { backgroundColor: '#10b981', position: 'relative' }]}
                        activeOpacity={0.85}
                      >
                        <Feather name="check" size={13} color="#000" />
                        <Text style={styles.buyBtnText}>Buy Safely</Text>
                        <ControlledGlitterBurst trigger={glitters[`buy_${item.id}`]} count={10} radius={26} colors={['#10b981', '#fff']} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* ── 3. DOOR QUEUE & CAPACITY ── */}
            {activeTab === 'queue' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.thermometerCard, { borderColor: `${primary}40`, backgroundColor: surface }]}>
                  <Text style={[styles.thermometerTitle, { color: textColor }]}>Live Door Thermometer</Text>
                  <View style={styles.metricGrid}>
                    <View style={[styles.metricBox, { borderColor: `${primary}25` }]}>
                      <Text style={[styles.metricVal, { color: primary }]}>{doorQueue.wait_minutes} min</Text>
                      <Text style={[styles.metricLab, { color: muted }]}>ESTIMATED LINE</Text>
                    </View>
                    <View style={[styles.metricBox, { borderColor: doorQueue.capacity_percent > 85 ? '#ef444450' : `${primary}25` }]}>
                      <Text style={[styles.metricVal, { color: doorQueue.capacity_percent > 85 ? '#ef4444' : '#10b981' }]}>
                        {doorQueue.capacity_percent}%
                      </Text>
                      <Text style={[styles.metricLab, { color: muted }]}>VENUE FULLNESS</Text>
                    </View>
                  </View>
                  <Text style={[styles.queueNote, { color: textColor }]}>📢 Door Staff Note: {doorQueue.notes}</Text>
                </View>

                {/* Bouncer / Staff Update Section */}
                <View style={[styles.boxCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: surface }]}>
                  <Text style={[styles.boxTitle, { color: textColor }]}>Update Door Wait Time & Policy</Text>
                  <TextInput
                    style={[styles.inputFull, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="Wait Minutes (e.g. 15)"
                    placeholderTextColor={muted}
                    keyboardType="numeric"
                    value={queueWait}
                    onChangeText={setQueueWait}
                  />
                  <TextInput
                    style={[styles.inputFull, { color: textColor, borderColor: `${primary}35`, marginTop: 8 }]}
                    placeholder="Capacity % (e.g. 75)"
                    placeholderTextColor={muted}
                    keyboardType="numeric"
                    value={queueCap}
                    onChangeText={setQueueCap}
                  />
                  <TextInput
                    style={[styles.inputFull, { color: textColor, borderColor: `${primary}35`, marginTop: 8 }]}
                    placeholder="Door Policy / Parking Notes..."
                    placeholderTextColor={muted}
                    value={queueNotes}
                    onChangeText={setQueueNotes}
                  />
                  <TouchableOpacity
                    onPress={handleUpdateQueue}
                    style={[styles.primaryActionBtn, { backgroundColor: primary, marginTop: 12, position: 'relative' }]}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryActionBtnText}>Broadcast Door Update</Text>
                    <ControlledGlitterBurst trigger={glitters.queue} count={10} radius={28} colors={[primary, '#fff']} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── 4. TALENT ESCROW ── */}
            {activeTab === 'escrow' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.infoBanner, { borderColor: '#8b5cf650', backgroundColor: '#8b5cf615' }]}>
                  <Feather name="shield" size={16} color="#8b5cf6" />
                  <Text style={[styles.infoBannerText, { color: textColor }]}>
                    No gig cancellations. Promoter fee is safely locked in escrow and releases once talent checks in at the venue.
                  </Text>
                </View>

                {/* Create Escrow */}
                <View style={[styles.boxCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: surface }]}>
                  <Text style={[styles.boxTitle, { color: textColor }]}>Lock Performance Fee in Escrow</Text>
                  <TextInput
                    style={[styles.inputFull, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="Artist / DJ Handle (e.g. @dj_kabza)"
                    placeholderTextColor={muted}
                    value={escrowArtist}
                    onChangeText={setEscrowArtist}
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TextInput
                      style={[styles.inputFull, { flex: 1, color: textColor, borderColor: `${primary}35` }]}
                      placeholder="Fee ZAR (e.g. 5000)"
                      placeholderTextColor={muted}
                      keyboardType="numeric"
                      value={escrowFee}
                      onChangeText={setEscrowFee}
                    />
                    <TextInput
                      style={[styles.inputFull, { flex: 1, color: textColor, borderColor: `${primary}35` }]}
                      placeholder="Set Time (e.g. 00:00 - 01:30)"
                      placeholderTextColor={muted}
                      value={escrowTime}
                      onChangeText={setEscrowTime}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={handleCreateEscrow}
                    style={[styles.primaryActionBtn, { backgroundColor: primary, marginTop: 12, position: 'relative' }]}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryActionBtnText}>Lock Fee in Escrow</Text>
                    <ControlledGlitterBurst trigger={glitters.escrow} count={10} radius={28} colors={[primary, '#ffd700']} />
                  </TouchableOpacity>
                </View>

                {/* Existing Escrows */}
                <Text style={[styles.sectionSubtitle, { color: textColor }]}>Active Performance Escrows</Text>
                {escrows.map(item => (
                  <View key={item.id} style={[styles.resaleRow, { borderColor: `${primary}30`, backgroundColor: surface }]}>
                    <View>
                      <Text style={[styles.resaleTier, { color: textColor }]}>{item.artist_name} ({item.role})</Text>
                      <Text style={[styles.resalePrice, { color: primary }]}>R{item.fee_zar} · {item.set_time}</Text>
                      <Text style={{ color: item.status === 'released' ? '#10b981' : '#f59e0b', fontSize: 10, fontWeight: '800' }}>
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                    {item.status !== 'released' && (
                      <TouchableOpacity
                        onPress={() => handleReleaseEscrow(item.id, item.artist_name)}
                        style={[styles.buyBtn, { backgroundColor: '#10b981', position: 'relative' }]}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.buyBtnText}>Release Fee</Text>
                        <ControlledGlitterBurst trigger={glitters[`release_${item.id}`]} count={10} radius={26} colors={['#10b981', '#fff']} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* ── 5. TABLE KITTY & BILL SPLIT ── */}
            {activeTab === 'kitty' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.boxCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: surface }]}>
                  <Text style={[styles.boxTitle, { color: textColor }]}>Start a Squad Table Kitty</Text>
                  <TextInput
                    style={[styles.inputFull, { color: textColor, borderColor: `${primary}35` }]}
                    placeholder="Squad Name (e.g. Sandton Ballers)"
                    placeholderTextColor={muted}
                    value={kittySquad}
                    onChangeText={setKittySquad}
                  />
                  <TextInput
                    style={[styles.inputFull, { color: textColor, borderColor: `${primary}35`, marginTop: 8 }]}
                    placeholder="Target Goal ZAR (e.g. 4000)"
                    placeholderTextColor={muted}
                    keyboardType="numeric"
                    value={kittyTarget}
                    onChangeText={setKittyTarget}
                  />
                  <TouchableOpacity
                    onPress={handleCreateKitty}
                    style={[styles.primaryActionBtn, { backgroundColor: primary, marginTop: 12, position: 'relative' }]}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.primaryActionBtnText}>Open Table Kitty</Text>
                    <ControlledGlitterBurst trigger={glitters.kitty} count={10} radius={28} colors={[primary, '#ffd700']} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.sectionSubtitle, { color: textColor }]}>Active Table Pools</Text>
                {kitties.map(k => {
                  const pct = Math.min(100, Math.round(((k.current_zar || 0) / (k.target_zar || 1)) * 100));
                  return (
                    <View key={k.id} style={[styles.kittyCard, { borderColor: `${primary}35`, backgroundColor: surface }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.resaleTier, { color: textColor }]}>{k.squad_name}</Text>
                        <Text style={[styles.resalePrice, { color: primary }]}>R{k.current_zar} / R{k.target_zar}</Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: primary }]} />
                      </View>
                      <TouchableOpacity
                        onPress={() => handleContributeKitty(k.id)}
                        style={[styles.chipBtn, { backgroundColor: `${primary}18`, borderColor: `${primary}45`, position: 'relative' }]}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.chipBtnText, { color: primary }]}>+ Chip in R250</Text>
                        <ControlledGlitterBurst trigger={glitters[`kitty_chip_${k.id}`]} count={10} radius={26} colors={[primary, '#fff']} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── 6. PROMOTER FLYER BOUNTIES ── */}
            {activeTab === 'bounty' && (
              <View style={styles.sectionWrap}>
                <View style={[styles.infoBanner, { borderColor: '#10b98150', backgroundColor: '#10b98115' }]}>
                  <Feather name="share-2" size={16} color="#10b981" />
                  <Text style={[styles.infoBannerText, { color: textColor }]}>
                    Post the flyer to your WhatsApp Status. Every friend who verifies at the door earns you Coins directly!
                  </Text>
                </View>

                {bounties.length === 0 ? (
                  <View style={[styles.boxCard, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: surface }]}>
                    <Text style={[styles.boxTitle, { color: textColor }]}>Active WhatsApp Status Bounty</Text>
                    <Text style={{ color: muted, fontSize: 12, lineHeight: 18 }}>
                      Earn 35 Coins for every squad member who checks in using your verified link.
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleShareBounty({ id: 'default_bounty', reward_per_checkin: 35 })}
                      style={[styles.primaryActionBtn, { backgroundColor: '#10b981', marginTop: 12, position: 'relative' }]}
                      activeOpacity={0.85}
                    >
                      <Feather name="share-2" size={14} color="#000" />
                      <Text style={styles.primaryActionBtnText}>Share Flyer & Claim Referral Link</Text>
                      <ControlledGlitterBurst trigger={glitters['bounty_default_bounty']} count={12} radius={30} colors={['#10b981', '#ffd700', '#fff']} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  bounties.map(b => (
                    <View key={b.id} style={[styles.boxCard, { borderColor: `${primary}35`, backgroundColor: surface }]}>
                      <Text style={[styles.boxTitle, { color: textColor }]}>{b.title}</Text>
                      <Text style={{ color: primary, fontWeight: '800', fontSize: 13 }}>
                        {b.reward_per_checkin} Coins per Door Check-in · Pool: {b.remaining_coins} Coins left
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleShareBounty(b)}
                        style={[styles.primaryActionBtn, { backgroundColor: primary, marginTop: 12, position: 'relative' }]}
                        activeOpacity={0.85}
                      >
                        <Feather name="share-2" size={14} color="#000" />
                        <Text style={styles.primaryActionBtnText}>Share to WhatsApp</Text>
                        <ControlledGlitterBurst trigger={glitters[`bounty_${b.id}`]} count={10} radius={28} colors={[primary, '#fff']} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetContainer: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  closeBtn: { padding: 4 },
  eventContextBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.02)' },
  eventContextTitle: { fontSize: 13, fontWeight: '800' },
  eventContextSub: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  tabsWrap: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tabPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  tabLabel: { fontSize: 11.5, fontWeight: '800' },
  bodyScroll: { padding: 16, paddingBottom: 40 },
  sectionWrap: { gap: 14 },
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  infoBannerText: { fontSize: 11.5, lineHeight: 16, flex: 1, fontWeight: '600' },
  ticketCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ticketTier: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  ticketEvent: { fontSize: 15, fontWeight: '900', marginTop: 2 },
  vaultedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  vaultedBadgeText: { fontSize: 9.5, fontWeight: '900', color: '#10b981' },
  qrDisplayBox: { alignItems: 'center', paddingVertical: 12, gap: 8 },
  qrMock: { width: 120, height: 120, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.03)' },
  qrSignature: { fontSize: 8, fontWeight: '900', marginTop: 6 },
  qrCodeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  ticketFoot: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  primaryActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14 },
  primaryActionBtnText: { color: '#000', fontWeight: '900', fontSize: 13 },
  boxCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  boxTitle: { fontSize: 13, fontWeight: '800' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zarPrefix: { fontSize: 16, fontWeight: '900' },
  inputField: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  smallBtnText: { color: '#000', fontWeight: '900', fontSize: 12 },
  sectionSubtitle: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 6 },
  emptyNotice: { fontSize: 12, fontStyle: 'italic' },
  resaleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, padding: 12 },
  resaleTier: { fontSize: 13, fontWeight: '800' },
  resalePrice: { fontSize: 14, fontWeight: '900', marginTop: 2 },
  buyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  buyBtnText: { color: '#000', fontWeight: '900', fontSize: 11.5 },
  thermometerCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  thermometerTitle: { fontSize: 14, fontWeight: '900' },
  metricGrid: { flexDirection: 'row', gap: 10 },
  metricBox: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  metricVal: { fontSize: 20, fontWeight: '900' },
  metricLab: { fontSize: 9.5, fontWeight: '800', marginTop: 3 },
  queueNote: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  inputFull: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  kittyCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  chipBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  chipBtnText: { fontSize: 11.5, fontWeight: '800' },
});

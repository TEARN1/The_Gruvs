/**
 * EventFlyerSpreadModal — In-Event Digital Flyer AirDrop & Spread Modal.
 *
 * Allows a business, promoter, or creator to "throw around" a digital flyer
 * to everyone inside the event (Touch Down), RSVP'd attendees, or past visitors.
 *
 * Features:
 *   - Target Audience Selector with live estimated headcounts
 *   - Digital Flyer composer: headline, perk/discount code, CTA, optional image
 *   - Live interactive flyer preview card
 *   - 1-tap Spread with haptic feedback and ControlledGlitterBurst
 */
import React, { useState, useEffect } from 'react';
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
import { SmartImage } from './SmartImage';
import { ControlledGlitterBurst } from './ControlledGlitterBurst';
import { EventFlyerService, TARGET_AUDIENCES } from '../services/eventFlyerService';
import { haptics } from '../utils/haptics';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';

export function EventFlyerSpreadModal({
  visible,
  event,
  onClose,
  primary = '#00f2ff',
  bg = '#080b0d',
  textColor = '#fff',
  muted = 'rgba(255,255,255,0.55)',
}) {
  const { user } = useAuth();
  const { show: toast } = useToast();

  const [target, setTarget] = useState('here_now');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [perkCode, setPerkCode] = useState('');
  const [ctaText, setCtaText] = useState('Claim 20% Off');
  const [audienceEstimate, setAudienceEstimate] = useState({ count: 85, estimatedCoins: 25 });
  const [loading, setLoading] = useState(false);
  const [spreading, setSpreading] = useState(false);
  const [spreadSuccess, setSpreadSuccess] = useState(false);
  const [glitterFx, setGlitterFx] = useState(0);

  useEffect(() => {
    if (!visible || !event?.id) return;
    setSpreadSuccess(false);
    setLoading(true);
    EventFlyerService.getAudienceEstimate(event.id, target).then((res) => {
      setAudienceEstimate(res);
      setLoading(false);
    });
  }, [visible, event?.id, target]);

  const handleSpread = async () => {
    if (!headline.trim()) {
      toast('Please enter a headline for your flyer', 'info');
      return;
    }
    setSpreading(true);
    try {
      await EventFlyerService.spreadFlyer({
        eventId: event?.id,
        authorId: user?.id,
        businessName: user?.user_metadata?.business_name || user?.user_metadata?.full_name || 'Vibe Partner',
        title: headline.trim(),
        description: description.trim(),
        perkCode: perkCode.trim().toUpperCase(),
        ctaText: ctaText.trim() || 'Claim Special',
        targetAudience: target,
        coinsSpent: audienceEstimate.estimatedCoins,
      });

      try { haptics.success(); } catch {}
      setGlitterFx(Date.now());
      setSpreadSuccess(true);
      toast(`Flyer spread to ${audienceEstimate.count} vibers!`, 'success');
    } catch {
      toast('Could not spread flyer. Try again.', 'error');
    } finally {
      setSpreading(false);
    }
  };

  if (!visible) return null;

  const currentTargetMeta = TARGET_AUDIENCES[target] || TARGET_AUDIENCES.here_now;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[styles.sheet, { backgroundColor: 'rgba(10,14,16,0.98)', borderColor: `${primary}35` }]}>
          {/* Header */}
          <View style={styles.headRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Feather name="send" size={17} color={primary} />
                <Text style={[styles.title, { color: textColor }]}>Spread In-Event Flyer</Text>
              </View>
              <Text style={[styles.sub, { color: muted }]} numberOfLines={1}>
                {event?.title ? `Targeting ${event.title}` : 'Drop digital flyers to crowd'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.closeBtn}>
              <Feather name="x" size={18} color={muted} />
            </TouchableOpacity>
          </View>

          {spreadSuccess ? (
            <View style={styles.successState}>
              <View style={[styles.successIcon, { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                <Feather name="check" size={28} color="#10b981" />
                <ControlledGlitterBurst trigger={glitterFx} count={16} radius={45} colors={['#10b981', '#00f2ff', '#fde047', '#fff']} />
              </View>
              <Text style={{ color: textColor, fontSize: 18, fontWeight: '900', marginTop: 14 }}>
                Flyer Dropped Live!
              </Text>
              <Text style={{ color: muted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 6, paddingHorizontal: 20 }}>
                Your digital flyer is now active on the event bulletin and attendee profiles for all{' '}
                <Text style={{ color: '#10b981', fontWeight: '800' }}>{audienceEstimate.count} people</Text> in target.
              </Text>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.doneBtn, { backgroundColor: primary }]}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#000', fontWeight: '900', fontSize: 14 }}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 10 }}>
              {/* Target Audience Tabs */}
              <View style={{ gap: 6 }}>
                <Text style={[styles.sectionLabel, { color: muted }]}>WHO RECEIVES THIS FLYER?</Text>
                <View style={styles.targetRow}>
                  {Object.values(TARGET_AUDIENCES).map((item) => {
                    const isSelected = target === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        onPress={() => setTarget(item.key)}
                        style={[
                          styles.targetCard,
                          {
                            borderColor: isSelected ? item.color : 'rgba(255,255,255,0.12)',
                            backgroundColor: isSelected ? `${item.color}20` : 'rgba(255,255,255,0.03)',
                          },
                        ]}
                        activeOpacity={0.7}
                      >
                        <Feather name={item.icon} size={15} color={isSelected ? item.color : muted} />
                        <Text style={[styles.targetLabel, { color: isSelected ? item.color : textColor }]}>
                          {item.label}
                        </Text>
                        <Text style={[styles.targetBadge, { color: muted }]}>{item.badge}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Audience Reach Bar */}
              <View style={[styles.audienceBar, { borderColor: `${currentTargetMeta.color}35`, backgroundColor: `${currentTargetMeta.color}10` }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Feather name="users" size={16} color={currentTargetMeta.color} />
                  <View>
                    <Text style={{ color: textColor, fontSize: 13, fontWeight: '800' }}>
                      {loading ? 'Estimating...' : `Estimated reach: ~${audienceEstimate.count} Vibers`}
                    </Text>
                    <Text style={{ color: muted, fontSize: 11 }}>{currentTargetMeta.desc}</Text>
                  </View>
                </View>
                <View style={[styles.coinCostPill, { borderColor: `${primary}40`, backgroundColor: `${primary}18` }]}>
                  <Text style={{ color: primary, fontSize: 11, fontWeight: '900' }}>
                    ⚡ {audienceEstimate.estimatedCoins} coins
                  </Text>
                </View>
              </View>

              {/* Form Inputs */}
              <View style={{ gap: 10 }}>
                <View>
                  <Text style={[styles.inputLabel, { color: muted }]}>FLYER HEADLINE *</Text>
                  <TextInput
                    value={headline}
                    onChangeText={setHeadline}
                    placeholder="e.g. Free Welcome Tequila with any burger!"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={[styles.input, { color: textColor, borderColor: 'rgba(255,255,255,0.14)' }]}
                    maxLength={60}
                  />
                </View>

                <View>
                  <Text style={[styles.inputLabel, { color: muted }]}>DESCRIPTION & OFFER DETAILS</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="e.g. Flash this flyer at the VIP bar before 1 AM to redeem."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    multiline
                    numberOfLines={2}
                    style={[styles.input, styles.textArea, { color: textColor, borderColor: 'rgba(255,255,255,0.14)' }]}
                    maxLength={140}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: muted }]}>CLAIM CODE (OPTIONAL)</Text>
                    <TextInput
                      value={perkCode}
                      onChangeText={setPerkCode}
                      placeholder="e.g. VIBE20"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      autoCapitalize="characters"
                      style={[styles.input, { color: primary, fontWeight: '800', borderColor: 'rgba(255,255,255,0.14)' }]}
                      maxLength={12}
                    />
                  </View>
                  <View style={{ flex: 1.2 }}>
                    <Text style={[styles.inputLabel, { color: muted }]}>BUTTON ACTION (CTA)</Text>
                    <TextInput
                      value={ctaText}
                      onChangeText={setCtaText}
                      placeholder="e.g. Claim Drink"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      style={[styles.input, { color: textColor, borderColor: 'rgba(255,255,255,0.14)' }]}
                      maxLength={20}
                    />
                  </View>
                </View>
              </View>

              {/* Live Card Preview */}
              <View style={{ gap: 6 }}>
                <Text style={[styles.sectionLabel, { color: muted }]}>LIVE FLYER PREVIEW (HOW VIBERS SEE IT)</Text>
                <View style={[styles.previewCard, { borderColor: `${primary}45`, backgroundColor: 'rgba(15,22,25,0.95)' }]}>
                  <View style={styles.previewTop}>
                    <View style={styles.previewBadge}>
                      <Text style={styles.previewBadgeText}>SPONSORED FLYER</Text>
                    </View>
                    <Text style={{ color: muted, fontSize: 10 }}>Live In Venue</Text>
                  </View>
                  <Text style={[styles.previewTitle, { color: textColor }]}>
                    {headline.trim() || 'Your Catchy Headline Appears Here'}
                  </Text>
                  {description.trim() ? (
                    <Text style={[styles.previewDesc, { color: muted }]}>{description.trim()}</Text>
                  ) : null}
                  <View style={styles.previewBottom}>
                    {perkCode.trim() ? (
                      <View style={[styles.perkPill, { borderColor: `${primary}55`, backgroundColor: `${primary}20` }]}>
                        <Text style={{ color: primary, fontSize: 11, fontWeight: '900' }}>
                          CODE: {perkCode.trim().toUpperCase()}
                        </Text>
                      </View>
                    ) : <View />}
                    <View style={[styles.previewBtn, { backgroundColor: primary }]}>
                      <Text style={{ color: '#000', fontWeight: '900', fontSize: 11 }}>
                        {ctaText.trim() || 'Claim'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <TouchableOpacity
                onPress={handleSpread}
                disabled={spreading}
                style={[styles.spreadBtn, { backgroundColor: primary }]}
                activeOpacity={0.8}
              >
                {spreading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Feather name="zap" size={16} color="#000" />
                    <Text style={styles.spreadBtnText}>
                      Spread To {audienceEstimate.count} Vibers
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' } : {}),
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '90%',
    padding: 18,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 12,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  targetRow: {
    flexDirection: 'row',
    gap: 8,
  },
  targetCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  targetLabel: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  targetBadge: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  audienceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  coinCostPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 5,
  },
  input: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  textArea: {
    height: 60,
    paddingTop: 8,
  },
  previewCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewBadge: {
    backgroundColor: '#ff007a22',
    borderWidth: 1,
    borderColor: '#ff007a55',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  previewBadgeText: {
    color: '#ff007a',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  previewDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  previewBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  perkPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  previewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  spreadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
    marginTop: 6,
  },
  spreadBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
  },
  successState: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  doneBtn: {
    width: '100%',
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
});

export default EventFlyerSpreadModal;

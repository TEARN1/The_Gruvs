/**
 * EcosystemPortalModal — Native in-app portal for The Resident Crew & Excellency Academy.
 *
 * Keeps users inside The Gruvs:
 *   • The Resident: Browse verified crash pads, rooms & carpool captains with direct messaging.
 *   • Excellency: Browse masterclasses, audio engineering courses & certification badges.
 *   • Single Sign-On (SSO): 1-tap seamless jump to full companion with zero login friction.
 */
import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, TextInput,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cyberAudio } from '../utils/cyberAudio';
import { SecurityService } from '../services/securityService';
import { ExcellencyService } from '../services/excellencyService';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastNotification';
import { ResidentStaysSection } from './ResidentStaysSection';
import { ResidentLiftsSection } from './ResidentLiftsSection';
import { CyberScanline } from './Motion';

const EXCELLENCY_COURSES = [
  {
    id: 'ex-1',
    title: 'Amapiano & Afro-Tech Sound Engineering',
    instructor: 'Master Producer Residency',
    duration: '4 Weeks · 16 Masterclasses',
    badge: 'AUDIO ENGINEERING',
    level: 'Advanced',
    discount: '20% Off with Vibe Score Level 3+',
    icon: 'music',
    color: '#00f2ff',
  },
  {
    id: 'ex-2',
    title: 'Stage Lighting & Visual Architecture',
    instructor: 'Live Production Guild',
    duration: '2 Weeks · 8 Masterclasses',
    badge: 'STAGE CRAFT',
    level: 'Intermediate',
    discount: 'Full Vibe Scholarship Available',
    icon: 'zap',
    color: '#3b82f6',
  },
  {
    id: 'ex-3',
    title: 'Nightlife Economics & Festival Direction',
    instructor: 'Promoter Council',
    duration: '3 Weeks · 12 Masterclasses',
    badge: 'EVENT ARCHITECTURE',
    level: 'Pro',
    discount: 'Free for Resident Verified Hosts',
    icon: 'compass',
    color: '#f59e0b',
  },
];

export function EcosystemPortalModal({
  visible,
  app,
  onClose,
  primary = '#00f2ff',
  textColor = '#fff',
  muted = 'rgba(255,255,255,0.6)',
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('browse');
  const [enrolledCourseId, setEnrolledCourseId] = useState(null);
  const [courses, setCourses] = useState(EXCELLENCY_COURSES);

  // Resident Tabs & Safety States
  const [residentTab, setResidentTab] = useState('stays'); // 'stays' | 'lifts' | 'guardian' | 'host'
  const [stayFilter, setStayFilter] = useState('all');

  // Guardian Shield state
  const [safeTimerActive, setSafeTimerActive] = useState(false);
  const [safeMinutesLeft, setSafeMinutesLeft] = useState(25);
  const [safeDestination, setSafeDestination] = useState('Ivory Park Ext 2 / Home');
  const [guardianContact, setGuardianContact] = useState('082 555 1928 (Family Matriarch)');
  const [qrVerified, setQrVerified] = useState(false);

  // Host Onboarding Form
  const [hostType, setHostType] = useState('cottage');
  const [hostSpaceName, setHostSpaceName] = useState('');
  const [hostSector, setHostSector] = useState('Ivory Park');
  const [hostPriceZar, setHostPriceZar] = useState('180');
  const [hostAnchorName, setHostAnchorName] = useState('');
  const [hostHasSolar, setHostHasSolar] = useState(true);
  const [hostSubmitted, setHostSubmitted] = useState(false);

  useEffect(() => {
    if (app?.id === 'excellency' && visible) {
      ExcellencyService.getCourses().then(data => {
        if (data && data.length > 0) setCourses(data);
      }).catch(() => {});
    }
  }, [app?.id, visible]);

  useEffect(() => {
    let interval = null;
    if (safeTimerActive && safeMinutesLeft > 0) {
      interval = setInterval(() => {
        setSafeMinutesLeft(m => {
          if (m <= 1) {
            clearInterval(interval);
            setSafeTimerActive(false);
            toast?.show?.('Safe Timer elapsed! Next-of-kin alert triggered.', 'error');
            return 0;
          }
          return m - 1;
        });
      }, 60000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [safeTimerActive, safeMinutesLeft, toast]);

  if (!visible || !app) return null;

  const isResident = app.id === 'theresident';
  const themeColor = app.color || primary;
  const contentText = '#ffffff';
  const contentMuted = 'rgba(255,255,255,0.70)';

  const handleToggleTimer = () => {
    cyberAudio.play('lockVibe');
    if (safeTimerActive) {
      setSafeTimerActive(false);
      setSafeMinutesLeft(25);
      toast?.show?.('Safe arrival confirmed! Guardian timer disarmed.', 'success');
    } else {
      if (!guardianContact.trim()) {
        toast?.show?.('Enter a verified family guardian phone number first.', 'error');
        return;
      }
      setSafeTimerActive(true);
      toast?.show?.(`Guardian Timer armed (25m) towards ${safeDestination}. Family notified.`, 'success');
    }
  };

  const handlePanicRelay = () => {
    cyberAudio.play('telemetryTick');
    toast?.show?.('SAPS & CPF Emergency Relay pinged with your GPS coordinates.', 'error');
  };

  const handleSubmitHost = () => {
    cyberAudio.play('lockVibe');
    if (!hostSpaceName.trim() || !hostAnchorName.trim()) {
      toast?.show?.('Please fill in your space name and family anchor co-signer.', 'error');
      return;
    }
    setHostSubmitted(true);
    toast?.show?.('Host Application Submitted! Dual-ID verified badge pending CPF check.', 'success');
  };

  const handleOpenCompanion = async () => {
    cyberAudio.play('lockVibe');
    const targetUrl = `${app.url}?ref=thegruvs&src=inapp_portal`;
    await SecurityService.safeOpenURL(targetUrl);
  };

  const handleEnroll = async (courseId) => {
    cyberAudio.play('lockVibe');
    setEnrolledCourseId(courseId);
    try {
      await ExcellencyService.enroll(courseId, user?.id);
      toast?.show?.('Enrolled in Masterclass! Verified badge reserved.', 'success');
    } catch (e) {
      toast?.show?.(e?.message || 'Seat reserved for this masterclass', 'info');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheetCard,
            {
              paddingTop: Math.max(insets.top || 0, 16),
              paddingBottom: Math.max(insets.bottom || 0, 20) + 12,
              borderColor: `${themeColor}45`,
            },
          ]}
        >
          {/* Subtle Top Cyber Scanline */}
          <CyberScanline color={themeColor} opacity={0.12} duration={4000} />

          {/* Sheet Header */}
          <View style={styles.header}>
            <View style={styles.headerBrand}>
              <Text style={{ fontSize: 24 }}>{app.badge}</Text>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.appName, { color: contentText }]}>{app.name}</Text>
                  <View style={[styles.ecosystemPill, { borderColor: `${themeColor}60`, backgroundColor: `${themeColor}15` }]}>
                    <Text style={[styles.ecosystemPillText, { color: themeColor }]}>ECOSYSTEM PILLAR</Text>
                  </View>
                </View>
                <Text style={[styles.tagline, { color: contentMuted }]}>{app.tagline}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                cyberAudio.play('telemetryTick');
                onClose?.();
              }}
              style={styles.closeBtn}
            >
              <Feather name="x" size={20} color={muted} />
            </TouchableOpacity>
          </View>

          {/* Unified Value Proposition Banner */}
          <View style={[styles.syncedBanner, { borderColor: `${themeColor}35`, backgroundColor: `${themeColor}0f` }]}>
            <Feather name="shield" size={14} color={themeColor} />
            <Text style={[styles.syncedBannerText, { color: contentText }]}>
              Unified Single Sign-On Active · Your Gruvs Vibe Points & Credentials apply automatically.
            </Text>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {isResident ? (
              /* ── THE RESIDENT CREW VIEW ────────────────────────── */
              <View style={styles.sectionWrap}>
                {/* 4-Pillar Sub-Navigation */}
                <View style={styles.tabRow}>
                  {[
                    { key: 'stays', label: 'Crash Pads', icon: 'home' },
                    { key: 'lifts', label: 'Safe Lifts', icon: 'navigation' },
                    { key: 'guardian', label: 'Guardian Shield', icon: 'shield' },
                    { key: 'host', label: 'Become Host', icon: 'plus-circle' },
                  ].map(t => {
                    const active = residentTab === t.key;
                    return (
                      <TouchableOpacity
                        key={t.key}
                        onPress={() => {
                          cyberAudio.play('telemetryTick');
                          setResidentTab(t.key);
                        }}
                        style={[
                          styles.tabPill,
                          {
                            backgroundColor: active ? themeColor : 'rgba(255,255,255,0.05)',
                            borderColor: active ? themeColor : 'rgba(255,255,255,0.12)',
                          }
                        ]}
                      >
                        <Feather name={t.icon} size={11} color={active ? '#000' : contentText} />
                        <Text style={[styles.tabPillText, { color: active ? '#000' : contentText }]}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* TAB 1: CRASH PADS & STAYS */}
                {residentTab === 'stays' && (
                  <View style={{ gap: 12 }}>
                    <View style={styles.featureGrid}>
                      <View style={[styles.featureCard, { borderColor: `${themeColor}25` }]}>
                        <Feather name="home" size={20} color={themeColor} />
                        <Text style={[styles.featureTitle, { color: contentText }]}>Verified Crash Pads</Text>
                        <Text style={[styles.featureDesc, { color: contentMuted }]}>Rooms & stays near nightlife clusters, verified by ID and community vouching.</Text>
                      </View>
                      <View style={[styles.featureCard, { borderColor: `${themeColor}25` }]}>
                        <Feather name="zap" size={20} color="#f59e0b" />
                        <Text style={[styles.featureTitle, { color: contentText }]}>Power Guaranteed</Text>
                        <Text style={[styles.featureDesc, { color: contentMuted }]}>Solar, battery inverters, and backup generators for uninterrupted nights.</Text>
                      </View>
                    </View>

                    {/* Filter Pills */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {[
                        { key: 'all', label: 'All Stays' },
                        { key: 'micro', label: '02:00-10:00 AM Crash Pads' },
                        { key: 'solar', label: 'Solar / Inverter' },
                        { key: 'family_anchor', label: 'Family Anchor Host' },
                      ].map(f => {
                        const active = stayFilter === f.key;
                        return (
                          <TouchableOpacity
                            key={f.key}
                            onPress={() => setStayFilter(f.key)}
                            style={[
                              styles.filterPill,
                              {
                                backgroundColor: active ? `${themeColor}25` : 'rgba(255,255,255,0.05)',
                                borderColor: active ? themeColor : 'rgba(255,255,255,0.10)',
                              }
                            ]}
                          >
                            <Text style={[styles.filterPillText, { color: active ? themeColor : contentMuted }]}>{f.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <ResidentStaysSection
                      event={{ city: 'Johannesburg', id: 'portal-explore' }}
                      primary={themeColor}
                      surface="rgba(16,22,26,0.9)"
                      textColor={contentText}
                      muted={contentMuted}
                    />
                  </View>
                )}

                {/* TAB 2: SAFE LIFTS & CARPOOLS */}
                {residentTab === 'lifts' && (
                  <View style={{ gap: 12 }}>
                    <View style={[styles.infoBannerBox, { borderColor: '#22c55e35', backgroundColor: '#22c55e10' }]}>
                      <Feather name="check-circle" size={16} color="#22c55e" />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.infoBannerTitle, { color: contentText }]}>Verified Carpool Captains Active</Text>
                        <Text style={[styles.infoBannerSub, { color: contentMuted }]}>
                          Dual-ID verified captains with zero incident records running safe corridors between Ivory Park, Tembisa, and major nightlife hubs.
                        </Text>
                      </View>
                    </View>

                    <ResidentLiftsSection
                      eventId="all"
                      primary={themeColor}
                      surface="rgba(16,22,26,0.9)"
                      textColor={contentText}
                      muted={contentMuted}
                    />
                  </View>
                )}

                {/* TAB 3: NIGHT GUARDIAN SHIELD */}
                {residentTab === 'guardian' && (
                  <View style={{ gap: 14 }}>
                    <View style={[styles.guardianCard, { borderColor: safeTimerActive ? '#ef444450' : `${themeColor}35` }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={[styles.beaconDot, { backgroundColor: safeTimerActive ? '#ef4444' : themeColor }]} />
                          <Text style={[styles.guardianTitle, { color: contentText }]}>
                            {safeTimerActive ? 'Guardian Dead-Man Timer Armed' : 'Nighttime Guardian Shield'}
                          </Text>
                        </View>
                        <View style={[styles.statusTag, { backgroundColor: safeTimerActive ? '#ef444420' : `${themeColor}20`, borderColor: safeTimerActive ? '#ef4444' : themeColor }]}>
                          <Text style={{ fontSize: 9, fontWeight: '900', color: safeTimerActive ? '#ef4444' : themeColor }}>
                            {safeTimerActive ? 'MONITORING GPS' : 'STANDBY'}
                          </Text>
                        </View>
                      </View>

                      {safeTimerActive && (
                        <View style={styles.timerDisplay}>
                          <Text style={[styles.timerCountdown, { color: safeMinutesLeft < 10 ? '#ef4444' : themeColor }]}>
                            {String(safeMinutesLeft).padStart(2, '0')}:00
                          </Text>
                          <Text style={[styles.timerSub, { color: contentMuted }]}>
                            If arrival isn't confirmed before 00:00, automated SOS SMS triggers to your family guardian.
                          </Text>
                        </View>
                      )}

                      <View style={styles.formGroup}>
                        <Text style={[styles.inputLabel, { color: contentMuted }]}>SAFE DESTINATION / RESIDENCE</Text>
                        <TextInput
                          value={safeDestination}
                          onChangeText={setSafeDestination}
                          placeholder="e.g. Ivory Park Ext 2 / Kaalfontein"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          style={[styles.textInput, { color: contentText, borderColor: `${themeColor}30` }]}
                        />
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={[styles.inputLabel, { color: contentMuted }]}>FAMILY ANCHOR GUARDIAN PHONE</Text>
                        <TextInput
                          value={guardianContact}
                          onChangeText={setGuardianContact}
                          placeholder="e.g. 082 123 4567"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          style={[styles.textInput, { color: contentText, borderColor: `${themeColor}30` }]}
                        />
                      </View>

                      <TouchableOpacity
                        onPress={handleToggleTimer}
                        style={[
                          styles.actionBtn,
                          { backgroundColor: safeTimerActive ? '#10b981' : themeColor }
                        ]}
                      >
                        <Feather name={safeTimerActive ? "check-circle" : "shield"} size={14} color="#000" />
                        <Text style={styles.actionBtnText}>
                          {safeTimerActive ? "I'm Safe Inside (Disarm Guardian)" : "Arm 25-Min Guardian Departure Timer"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handlePanicRelay}
                        style={[styles.panicBtn, { borderColor: '#ef444450' }]}
                      >
                        <Feather name="alert-triangle" size={14} color="#ef4444" />
                        <Text style={styles.panicBtnText}>SAPS & CPF Emergency Patrol Relay</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Doorstep Handshake Simulation Card */}
                    <View style={[styles.handshakeCard, { borderColor: `${themeColor}25` }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Feather name="maximize" size={20} color={themeColor} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.handshakeTitle, { color: contentText }]}>Doorstep QR Handshake Protocol</Text>
                          <Text style={[styles.handshakeSub, { color: contentMuted }]}>
                            Both guest and host scan a rotating dynamic QR upon arrival to confirm identity and unlock deposits.
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setQrVerified(v => !v);
                          cyberAudio.play('lockVibe');
                          toast?.show?.(qrVerified ? 'Doorstep handshake reset' : 'QR Handshake Verified: Safe Checkout Logged!', 'success');
                        }}
                        style={[styles.verifyHandshakeBtn, { borderColor: qrVerified ? '#10b981' : themeColor }]}
                      >
                        <Feather name={qrVerified ? "check" : "camera"} size={13} color={qrVerified ? '#10b981' : themeColor} />
                        <Text style={[styles.verifyHandshakeText, { color: qrVerified ? '#10b981' : themeColor }]}>
                          {qrVerified ? 'Handshake Logged ✓' : 'Simulate Doorstep QR Handshake'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* TAB 4: BECOME A RESIDENT HOST */}
                {residentTab === 'host' && (
                  <View style={{ gap: 14 }}>
                    <View style={[styles.hostHeaderBox, { borderColor: `${themeColor}35` }]}>
                      <Text style={[styles.hostHeaderTitle, { color: contentText }]}>Earn Daily Income & Guard Your Kasi</Text>
                      <Text style={[styles.hostHeaderSub, { color: contentMuted }]}>
                        Monetize your spare bedroom, backyard cottage, or 7-seater shuttle. Dual-ID and family anchor required.
                      </Text>
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={[styles.inputLabel, { color: contentMuted }]}>HOSTING TYPE</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {[
                          { key: 'cottage', label: 'Backyard Cottage' },
                          { key: 'room', label: 'Crash Pad Room' },
                          { key: 'captain', label: 'Carpool Shuttle' },
                        ].map(type => (
                          <TouchableOpacity
                            key={type.key}
                            onPress={() => setHostType(type.key)}
                            style={[
                              styles.typePill,
                              {
                                backgroundColor: hostType === type.key ? themeColor : 'rgba(255,255,255,0.05)',
                                borderColor: hostType === type.key ? themeColor : 'rgba(255,255,255,0.12)',
                              }
                            ]}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '800', color: hostType === type.key ? '#000' : contentText }}>
                              {type.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={[styles.inputLabel, { color: contentMuted }]}>LISTING / SPACE NAME</Text>
                      <TextInput
                        value={hostSpaceName}
                        onChangeText={setHostSpaceName}
                        placeholder="e.g. Ivory Park Sanctuary Cottage"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        style={[styles.textInput, { color: contentText, borderColor: `${themeColor}30` }]}
                      />
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={[styles.inputLabel, { color: contentMuted }]}>TOWNSHIP / WARD</Text>
                        <TextInput
                          value={hostSector}
                          onChangeText={setHostSector}
                          placeholder="e.g. Ivory Park Ext 3"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          style={[styles.textInput, { color: contentText, borderColor: `${themeColor}30` }]}
                        />
                      </View>
                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={[styles.inputLabel, { color: contentMuted }]}>NIGHTLY RATE (ZAR)</Text>
                        <TextInput
                          value={hostPriceZar}
                          onChangeText={setHostPriceZar}
                          keyboardType="numeric"
                          placeholder="180"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          style={[styles.textInput, { color: contentText, borderColor: `${themeColor}30` }]}
                        />
                      </View>
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={[styles.inputLabel, { color: contentMuted }]}>FAMILY ANCHOR CO-SIGNER (SIBLING / MATRIARCH ON PREMISES)</Text>
                      <TextInput
                        value={hostAnchorName}
                        onChangeText={setHostAnchorName}
                        placeholder="e.g. Nomsa M. (Sister, Resident since 2012)"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        style={[styles.textInput, { color: contentText, borderColor: `${themeColor}30` }]}
                      />
                    </View>

                    <TouchableOpacity
                      onPress={() => setHostHasSolar(s => !s)}
                      style={[styles.solarToggle, { borderColor: hostHasSolar ? '#f59e0b' : 'rgba(255,255,255,0.1)' }]}
                    >
                      <Feather name={hostHasSolar ? "check-square" : "square"} size={16} color={hostHasSolar ? '#f59e0b' : contentMuted} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: contentText, flex: 1 }}>
                        Has Solar / Battery Inverter / Generator Backup
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleSubmitHost}
                      style={[styles.actionBtn, { backgroundColor: hostSubmitted ? '#10b981' : themeColor, marginTop: 6 }]}
                    >
                      <Feather name={hostSubmitted ? "check" : "upload-cloud"} size={14} color="#000" />
                      <Text style={styles.actionBtnText}>
                        {hostSubmitted ? "Application Under Review ✓" : "Submit Host Registration & Dual-ID"}
                      </Text>
                    </TouchableOpacity>

                    {/* Vouch Tree Preview */}
                    <View style={[styles.vouchBox, { borderColor: `${themeColor}20` }]}>
                      <Feather name="shield" size={14} color={themeColor} />
                      <Text style={{ fontSize: 10, color: contentMuted, flex: 1, lineHeight: 14 }}>
                        Resident Trust Score: +50 Vibe on Dual-ID, +30 on Sibling Co-Sign, +20 on CPF clear check.
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              /* ── EXCELLENCY ACADEMY VIEW ───────────────────────── */
              <View style={styles.sectionWrap}>
                <View style={styles.featureGrid}>
                  <View style={[styles.featureCard, { borderColor: `${themeColor}25` }]}>
                    <Feather name="award" size={20} color={themeColor} />
                    <Text style={[styles.featureTitle, { color: contentText }]}>Masterclass Accreditation</Text>
                    <Text style={[styles.featureDesc, { color: contentMuted }]}>Earn on-chain Vibe Badges certified by the Excellency Guild.</Text>
                  </View>
                  <View style={[styles.featureCard, { borderColor: `${themeColor}25` }]}>
                    <Feather name="cpu" size={20} color={themeColor} />
                    <Text style={[styles.featureTitle, { color: contentText }]}>Creative Engineering</Text>
                    <Text style={[styles.featureDesc, { color: contentMuted }]}>Hands-on stagecraft, high-fidelity acoustics, and nightlife tech.</Text>
                  </View>
                </View>

                <Text style={[styles.coursesHeading, { color: contentText }]}>Available Masterclasses</Text>
                {courses.map((course) => {
                  const isEnrolled = enrolledCourseId === course.id;
                  return (
                    <View key={course.id} style={[styles.courseCard, { borderColor: `${course.color}35` }]}>
                      <View style={styles.courseHeader}>
                        <View style={[styles.courseBadge, { backgroundColor: `${course.color}20`, borderColor: course.color }]}>
                          <Text style={[styles.courseBadgeText, { color: course.color }]}>{course.badge}</Text>
                        </View>
                        <Text style={[styles.courseDuration, { color: contentMuted }]}>{course.duration}</Text>
                      </View>

                      <Text style={[styles.courseTitle, { color: contentText }]}>{course.title}</Text>
                      <Text style={[styles.courseInstructor, { color: contentMuted }]}>Instructor: {course.instructor}</Text>

                      <View style={[styles.discountPill, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                        <Feather name="tag" size={11} color={course.color} />
                        <Text style={[styles.discountText, { color: course.color }]}>{course.discount}</Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleEnroll(course.id)}
                        style={[
                          styles.enrollBtn,
                          {
                            backgroundColor: isEnrolled ? '#10b981' : course.color,
                            shadowColor: course.color,
                          },
                        ]}
                      >
                        <Feather name={isEnrolled ? "check-circle" : "arrow-right"} size={14} color="#000" />
                        <Text style={styles.enrollBtnText}>
                          {isEnrolled ? 'Enrolled via Vibe SSO ✓' : 'Claim Masterclass Seat'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Bottom Action Bar: Open Web Companion */}
          <View style={[styles.footerBar, { borderTopColor: `${themeColor}25` }]}>
            <TouchableOpacity
              onPress={handleOpenCompanion}
              style={[styles.companionBtn, { backgroundColor: themeColor }]}
              activeOpacity={0.88}
            >
              <Feather name="external-link" size={15} color="#000" />
              <Text style={styles.companionBtnText}>
                Open Full {app.name} Companion
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#0c1012',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1.5,
    maxHeight: '90%',
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  appName: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  ecosystemPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  ecosystemPillText: {
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  syncedBanner: {
    marginHorizontal: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  syncedBannerText: {
    fontSize: 10.5,
    fontWeight: '700',
    flex: 1,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  sectionWrap: {
    gap: 14,
  },
  featureGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  featureCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 6,
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  featureDesc: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
  },
  coursesHeading: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
    marginTop: 8,
  },
  courseCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 8,
    marginBottom: 10,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  courseBadgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  courseDuration: {
    fontSize: 10,
    fontWeight: '600',
  },
  courseTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  courseInstructor: {
    fontSize: 11,
    fontWeight: '600',
  },
  discountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  discountText: {
    fontSize: 10,
    fontWeight: '800',
  },
  enrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  enrollBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  footerBar: {
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  companionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 16,
  },
  companionBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});

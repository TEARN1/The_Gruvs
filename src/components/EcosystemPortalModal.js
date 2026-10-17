/**
 * EcosystemPortalModal — Native in-app portal for The Resident Crew & Excellency Academy.
 *
 * Keeps users inside The Gruvs:
 *   • The Resident: Browse verified crash pads, rooms & carpool captains with direct messaging.
 *   • Excellency: Browse masterclasses, audio engineering courses & certification badges.
 *   • Single Sign-On (SSO): 1-tap seamless jump to full companion with zero login friction.
 */
import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cyberAudio } from '../utils/cyberAudio';
import { SecurityService } from '../services/securityService';
import { ResidentStaysSection } from './ResidentStaysSection';
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
  const [activeTab, setActiveTab] = useState('browse');
  const [enrolledCourseId, setEnrolledCourseId] = useState(null);

  if (!app) return null;

  const isResident = app.id === 'theresident';
  const themeColor = app.color || primary;

  const handleOpenCompanion = async () => {
    cyberAudio.play('lockVibe');
    const targetUrl = `${app.url}?ref=thegruvs&src=inapp_portal`;
    await SecurityService.safeOpenURL(targetUrl);
  };

  const handleEnroll = (courseId) => {
    cyberAudio.play('lockVibe');
    setEnrolledCourseId(courseId);
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
                  <Text style={[styles.appName, { color: textColor }]}>{app.name}</Text>
                  <View style={[styles.ecosystemPill, { borderColor: `${themeColor}60`, backgroundColor: `${themeColor}15` }]}>
                    <Text style={[styles.ecosystemPillText, { color: themeColor }]}>ECOSYSTEM PILLAR</Text>
                  </View>
                </View>
                <Text style={[styles.tagline, { color: muted }]}>{app.tagline}</Text>
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
            <Text style={[styles.syncedBannerText, { color: textColor }]}>
              Unified Single Sign-On Active · Your Gruvs Vibe Points & Credentials apply automatically.
            </Text>
          </View>

          <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {isResident ? (
              /* ── THE RESIDENT CREW VIEW ────────────────────────── */
              <View style={styles.sectionWrap}>
                <View style={styles.featureGrid}>
                  <View style={[styles.featureCard, { borderColor: `${themeColor}25` }]}>
                    <Feather name="home" size={20} color={themeColor} />
                    <Text style={[styles.featureTitle, { color: textColor }]}>Verified Crash Pads</Text>
                    <Text style={[styles.featureDesc, { color: muted }]}>Rooms & stays near nightlife clusters, verified by ID and community vouching.</Text>
                  </View>
                  <View style={[styles.featureCard, { borderColor: `${themeColor}25` }]}>
                    <Feather name="navigation" size={20} color={themeColor} />
                    <Text style={[styles.featureTitle, { color: textColor }]}>Safe Return Lifts</Text>
                    <Text style={[styles.featureDesc, { color: muted }]}>Vetted peer carpools with background-checked community captains.</Text>
                  </View>
                </View>

                {/* Stays Section */}
                <View style={{ marginTop: 14 }}>
                  <ResidentStaysSection
                    event={{ city: 'Johannesburg', id: 'portal-explore' }}
                    primary={themeColor}
                    surface="rgba(16,22,26,0.9)"
                    textColor={textColor}
                    muted={muted}
                  />
                </View>
              </View>
            ) : (
              /* ── EXCELLENCY ACADEMY VIEW ───────────────────────── */
              <View style={styles.sectionWrap}>
                <View style={styles.featureGrid}>
                  <View style={[styles.featureCard, { borderColor: `${themeColor}25` }]}>
                    <Feather name="award" size={20} color={themeColor} />
                    <Text style={[styles.featureTitle, { color: textColor }]}>Masterclass Accreditation</Text>
                    <Text style={[styles.featureDesc, { color: muted }]}>Earn on-chain Vibe Badges certified by the Excellency Guild.</Text>
                  </View>
                  <View style={[styles.featureCard, { borderColor: `${themeColor}25` }]}>
                    <Feather name="cpu" size={20} color={themeColor} />
                    <Text style={[styles.featureTitle, { color: textColor }]}>Creative Engineering</Text>
                    <Text style={[styles.featureDesc, { color: muted }]}>Hands-on stagecraft, high-fidelity acoustics, and nightlife tech.</Text>
                  </View>
                </View>

                <Text style={[styles.coursesHeading, { color: textColor }]}>Available Masterclasses</Text>
                {EXCELLENCY_COURSES.map((course) => {
                  const isEnrolled = enrolledCourseId === course.id;
                  return (
                    <View key={course.id} style={[styles.courseCard, { borderColor: `${course.color}35` }]}>
                      <View style={styles.courseHeader}>
                        <View style={[styles.courseBadge, { backgroundColor: `${course.color}20`, borderColor: course.color }]}>
                          <Text style={[styles.courseBadgeText, { color: course.color }]}>{course.badge}</Text>
                        </View>
                        <Text style={[styles.courseDuration, { color: muted }]}>{course.duration}</Text>
                      </View>

                      <Text style={[styles.courseTitle, { color: textColor }]}>{course.title}</Text>
                      <Text style={[styles.courseInstructor, { color: muted }]}>Instructor: {course.instructor}</Text>

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

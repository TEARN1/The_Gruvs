/**
 * ExcellencyMasterclassSection — Contextual masterclasses and craft mentorship on event screens.
 *
 * Bridges: The Gruvs (Event/Artist) ↔ Excellency Academy (Mastery & Craft).
 * Allows aspiring DJs, audio engineers, promoters, and vibers to enroll with 1-click Vibe Point discounts.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { cyberAudio } from '../utils/cyberAudio';
import { SecurityService } from '../services/securityService';

const MASTERCLASSES = [
  {
    id: 'ex-audio-1',
    title: 'Amapiano & Afro-Tech Audio Engineering',
    instructor: 'Excellency Residency Mentor',
    tag: 'PRODUCTION GUILD',
    pointsDiscount: '250 Vibe Pts = 20% Off',
    url: 'https://excellencyacs.com',
  },
  {
    id: 'ex-stage-2',
    title: 'Live Stage Lighting & Spatial Visuals',
    instructor: 'Concert Lighting Guild',
    tag: 'STAGE ARCHITECTURE',
    pointsDiscount: 'Free for Resident Verified Hosts',
    url: 'https://excellencyacs.com',
  },
];

export function ExcellencyMasterclassSection({
  event,
  primary = '#00f2ff',
  surface = '#12181a',
  textColor = '#fff',
  muted = 'rgba(255,255,255,0.6)',
}) {
  const [enrolled, setEnrolled] = useState({});

  const handleEnroll = async (course) => {
    cyberAudio.play('lockVibe');
    setEnrolled(prev => ({ ...prev, [course.id]: true }));
    const targetUrl = `${course.url}?ref=thegruvs_event_${event?.id || 'live'}`;
    await SecurityService.safeOpenURL(targetUrl);
  };

  return (
    <View style={[styles.container, { backgroundColor: surface, borderColor: `${primary}25` }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={{ fontSize: 16 }}>🏛️</Text>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.title, { color: textColor }]}>Excellency Masterclasses</Text>
              <View style={[styles.badge, { backgroundColor: `${primary}18`, borderColor: `${primary}45` }]}>
                <Text style={[styles.badgeText, { color: primary }]}>CRAFT ACADEMY</Text>
              </View>
            </View>
            <Text style={[styles.sub, { color: muted }]}>Master audio engineering, mixing & stagecraft with residency mentors</Text>
          </View>
        </View>
      </View>

      {/* Courses Rail */}
      <View style={styles.courseList}>
        {MASTERCLASSES.map((course) => {
          const isDone = enrolled[course.id];
          return (
            <View key={course.id} style={[styles.courseItem, { borderColor: `${primary}20` }]}>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.courseTag, { color: primary }]}>{course.tag}</Text>
                  <Text style={[styles.discountText, { color: '#10b981' }]}>· {course.pointsDiscount}</Text>
                </View>
                <Text style={[styles.courseTitle, { color: textColor }]}>{course.title}</Text>
                <Text style={[styles.courseInstructor, { color: muted }]}>By {course.instructor}</Text>
              </View>

              <TouchableOpacity
                onPress={() => handleEnroll(course)}
                style={[
                  styles.enrollBtn,
                  { backgroundColor: isDone ? '#10b981' : `${primary}22`, borderColor: isDone ? '#10b981' : primary },
                ]}
                activeOpacity={0.8}
              >
                <Feather name={isDone ? "check" : "chevron-right"} size={14} color={isDone ? "#fff" : primary} />
                <Text style={[styles.enrollBtnText, { color: isDone ? "#fff" : primary }]}>
                  {isDone ? "Enrolled" : "Enroll"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    marginVertical: 8,
    gap: 12,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  sub: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  courseList: {
    gap: 10,
  },
  courseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    gap: 10,
  },
  courseTag: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  discountText: {
    fontSize: 9,
    fontWeight: '700',
  },
  courseTitle: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  courseInstructor: {
    fontSize: 10,
    fontWeight: '600',
  },
  enrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  enrollBtnText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});

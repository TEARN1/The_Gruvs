/**
 * ExcellencyService — Companion client for Excellency Academy.
 *
 * Manages audio engineering courses, masterclasses, and verified on-chain vibe credentials
 * across the ecosystem.
 */

import { supabase } from './supabase';
import { ThreatPreventionEngine } from './threatPreventionEngine';

export const DEFAULT_EXCELLENCY_COURSES = [
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
  {
    id: 'ex-4',
    title: 'Live DJ Performance & Dubplate Mastery',
    instructor: 'Resident DJ Guild',
    duration: '2 Weeks · 10 Masterclasses',
    badge: 'PERFORMANCE CRAFT',
    level: 'Intermediate',
    discount: 'Free with verified touch-downs',
    icon: 'disc',
    color: '#10b981',
  },
];

export const ExcellencyService = {
  /** Fetch all active masterclasses with local fallback */
  async getCourses() {
    try {
      const { data, error } = await supabase
        .from('exc_courses')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true });

      if (error || !data || data.length === 0) {
        return DEFAULT_EXCELLENCY_COURSES;
      }
      return data;
    } catch {
      return DEFAULT_EXCELLENCY_COURSES;
    }
  },

  /** Enroll in a masterclass with threat defense checking */
  async enroll(courseId, userId) {
    if (!courseId) throw new Error('Course ID required.');
    
    // Guard against SQL/PostgREST injection
    const cleanId = ThreatPreventionEngine.guard(courseId, { pillar: 'excellency', field: 'courseId' });

    try {
      // 1. Try dedicated secure RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('enroll_in_masterclass', {
        p_course_id: cleanId,
      });

      if (!rpcError && rpcData?.success) {
        return rpcData;
      }

      // 2. Fallback to direct insert if RPC is not yet deployed
      if (userId) {
        const { data, error } = await supabase
          .from('exc_enrollments')
          .insert({
            course_id: cleanId,
            student_id: userId,
            status: 'active',
            progress_percent: 0,
          })
          .select()
          .single();

        if (!error && data) return data;
      }

      return { success: true, course_id: cleanId, local_enrolled: true };
    } catch (e) {
      // Best effort fallback
      return { success: true, course_id: cleanId, local_enrolled: true };
    }
  },

  /** Fetch certifications earned by a user */
  async getUserCertifications(userId) {
    if (!userId) return [];
    try {
      const { data } = await supabase
        .from('exc_certifications')
        .select('*, exc_courses(*)')
        .eq('user_id', userId);
      return data || [];
    } catch {
      return [];
    }
  },
};

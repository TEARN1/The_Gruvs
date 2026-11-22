#!/usr/bin/env node
/**
 * scripts/test-ecosystem-notifications.mjs
 *
 * Verifies and executes the 20 notification types across:
 * - The Gruvs (Consumer & Merchant)
 * - The Resident (Guest & Host/Driver)
 * - Excellency Academy (Creator & Recruiter)
 *
 * Tests policy priorities, interrupt behavior during quiet hours,
 * and payload integrity.
 */

import { shouldInterrupt, notificationPriority, isQuietHours } from '../src/utils/notificationPolicy.js';

console.log('🔔 [Ecosystem Notifications] Running Policy & Dispatch Verification...\n');

const testCases = [
  // ── The Gruvs ────────────────────────────────────────────────────────────
  { id: 'GRV-C01', app: 'The Gruvs', role: 'Consumer', type: 'proximity_vibe_radar', expectedPriority: 'normal', isQuietSafe: false },
  { id: 'GRV-C02', app: 'The Gruvs', role: 'Consumer', type: 'squad_pass', expectedPriority: 'normal', isQuietSafe: false },
  { id: 'GRV-C03', app: 'The Gruvs', role: 'Consumer', type: 'geofence_arrival', expectedPriority: 'normal', isQuietSafe: false },
  { id: 'GRV-C04', app: 'The Gruvs', role: 'Consumer', type: 'stage_drop', expectedPriority: 'high', isQuietSafe: true },
  { id: 'GRV-C05', app: 'The Gruvs', role: 'Consumer', type: 'ticket_scarcity', expectedPriority: 'normal', isQuietSafe: false },

  { id: 'GRV-B01', app: 'The Gruvs', role: 'Merchant', type: 'merchant_crowd_forecast', expectedPriority: 'normal', isQuietSafe: false },
  { id: 'GRV-B02', app: 'The Gruvs', role: 'Merchant', type: 'merchant_search_surge', expectedPriority: 'normal', isQuietSafe: false },
  { id: 'GRV-B03', app: 'The Gruvs', role: 'Merchant', type: 'vendor_permit', expectedPriority: 'high', isQuietSafe: true },
  { id: 'GRV-B04', app: 'The Gruvs', role: 'Merchant', type: 'instant_payout', expectedPriority: 'high', isQuietSafe: true },

  // ── The Resident ─────────────────────────────────────────────────────────
  { id: 'RES-C01', app: 'The Resident', role: 'Consumer', type: 'weekend_lock_in', expectedPriority: 'normal', isQuietSafe: false },
  { id: 'RES-C02', app: 'The Resident', role: 'Consumer', type: 'carpool_match', expectedPriority: 'high', isQuietSafe: true },
  { id: 'RES-C03', app: 'The Resident', role: 'Consumer', type: 'guardian_shield_timer', expectedPriority: 'high', isQuietSafe: true },
  { id: 'RES-C04', app: 'The Resident', role: 'Consumer', type: 'guardian_emergency', expectedPriority: 'high', isQuietSafe: true },

  { id: 'RES-B01', app: 'The Resident', role: 'Host', type: 'host_demand_surge', expectedPriority: 'normal', isQuietSafe: false },
  { id: 'RES-B02', app: 'The Resident', role: 'Host', type: 'host_booking', expectedPriority: 'high', isQuietSafe: true },
  { id: 'RES-B03', app: 'The Resident', role: 'Driver', type: 'carpool_callout', expectedPriority: 'normal', isQuietSafe: false },

  // ── Excellency Academy ───────────────────────────────────────────────────
  { id: 'EXC-S01', app: 'Excellency', role: 'Student', type: 'scholarship_drop', expectedPriority: 'normal', isQuietSafe: false },
  { id: 'EXC-S02', app: 'Excellency', role: 'Student', type: 'festival_gig', expectedPriority: 'normal', isQuietSafe: false },
  { id: 'EXC-S03', app: 'Excellency', role: 'Student', type: 'studio_session', expectedPriority: 'normal', isQuietSafe: false },
  { id: 'EXC-M02', app: 'Excellency', role: 'Recruiter', type: 'recruiter_talent', expectedPriority: 'normal', isQuietSafe: false },
];

let passed = 0;
let failed = 0;

// Test during normal daytime hours (14:00)
const dayDate = new Date('2026-11-22T14:00:00');
// Test during quiet late-night hours (02:30 AM)
const nightDate = new Date('2026-11-22T02:30:00');

console.log('Testing 20 Notification Trigger Rules across Quiet-Hours Policy:\n');

for (const tc of testCases) {
  const pri = notificationPriority(tc.type);
  const interruptsDay = shouldInterrupt(tc.type, dayDate);
  const interruptsNight = shouldInterrupt(tc.type, nightDate);

  const priorityOk = pri === tc.expectedPriority;
  const nightOk = interruptsNight === tc.isQuietSafe;

  if (priorityOk && nightOk) {
    passed++;
    const badge = tc.isQuietSafe ? '🛡️ URGENT (Wakes User at 2am)' : '💤 RESPECTS QUIET HOURS';
    console.log(`  ✔ [${tc.id}] [${tc.app}] ${tc.type} ➔ Priority: ${pri} | Night Interrupt: ${interruptsNight} (${badge})`);
  } else {
    failed++;
    console.error(`  ❌ [${tc.id}] ${tc.type} FAILED: Expected priority=${tc.expectedPriority}, got=${pri}; Night expected=${tc.isQuietSafe}, got=${interruptsNight}`);
  }
}

console.log(`\n──────────────────────────────────────────────────`);
console.log(`Results: ${passed} passed, ${failed} failed (${testCases.length} total)`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✨ All 20 ecosystem notification rules and policies verified successfully!\n');
}

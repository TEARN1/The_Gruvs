/**
 * safetyCheckIn.js — "someone knows where I am tonight."
 *
 * The single most-asked-for feature in a going-out app, and the one that makes
 * a night feel survivable rather than risky. Deliberately built on things that
 * already work: trusted contacts live in local storage, and every alert is a
 * REAL direct message sent through the normal validated send path — no new
 * tables, no background service, nothing that can silently rot.
 *
 * HONESTY ABOUT WHAT THIS IS:
 *   • The share is the guarantee. The moment you start a check-in, your trusted
 *     contact is messaged — that message is delivered by the server and does
 *     not depend on your phone staying awake.
 *   • The timer is a best-effort NUDGE. It runs in the app, so if the app is
 *     closed it cannot fire. We never imply otherwise in the UI, because a
 *     safety promise that quietly fails is worse than no promise at all.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MessageManager } from './dataFlow';

const CONTACTS_KEY = 'gruvs_trusted_contacts_v1';
const ACTIVE_KEY   = 'gruvs_active_checkin_v1';
const MAX_CONTACTS = 5;

// ── Trusted contacts ────────────────────────────────────────────────────────
export async function getTrustedContacts() {
  try {
    const raw = await AsyncStorage.getItem(CONTACTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(0, MAX_CONTACTS) : [];
  } catch { return []; }
}

export async function addTrustedContact(contact) {
  if (!contact?.id) return await getTrustedContacts();
  const list = await getTrustedContacts();
  if (list.some((c) => c.id === contact.id)) return list;
  const next = [...list, {
    id: contact.id,
    username: contact.username || 'viber',
    avatar_url: contact.avatar_url || null,
  }].slice(0, MAX_CONTACTS);
  try { await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(next)); } catch {}
  return next;
}

export async function removeTrustedContact(id) {
  const next = (await getTrustedContacts()).filter((c) => c.id !== id);
  try { await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(next)); } catch {}
  return next;
}

// ── The active check-in ─────────────────────────────────────────────────────
export async function getActiveCheckIn() {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v.dueAt === 'number' ? v : null;
  } catch { return null; }
}

async function setActiveCheckIn(v) {
  try {
    if (v) await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(v));
    else await AsyncStorage.removeItem(ACTIVE_KEY);
  } catch {}
}

const hhmm = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Start a check-in: message every trusted contact right now, and remember when
 * we should nudge for an "I'm home". Returns { ok, sent, failed }.
 */
export async function startCheckIn({ userId, contacts, placeLabel, minutes }) {
  if (!userId || !contacts?.length) return { ok: false, sent: 0, failed: 0 };
  const dueAt = Date.now() + Math.max(5, Number(minutes) || 60) * 60000;
  const where = placeLabel ? ` at ${placeLabel}` : '';
  const body =
    `Safety check-in\n` +
    `I'm out${where} tonight and I've set you as my trusted contact.\n` +
    `I expect to be home by ${hhmm(dueAt)}. If you don't hear from me after that, check on me.`;

  let sent = 0, failed = 0;
  for (const c of contacts) {
    try {
      const msg = await MessageManager.send(userId, c.id, body);
      if (msg) sent++; else failed++;
    } catch { failed++; }
  }
  if (sent > 0) {
    await setActiveCheckIn({ dueAt, placeLabel: placeLabel || null, contactIds: contacts.map((c) => c.id) });
  }
  return { ok: sent > 0, sent, failed };
}

/** "I'm home safe" — reassure everyone and clear the check-in. */
export async function completeCheckIn({ userId }) {
  const active = await getActiveCheckIn();
  await setActiveCheckIn(null);
  if (!userId || !active?.contactIds?.length) return { ok: true, sent: 0 };
  let sent = 0;
  for (const id of active.contactIds) {
    try { if (await MessageManager.send(userId, id, 'Home safe. Thanks for looking out for me.')) sent++; } catch {}
  }
  return { ok: true, sent };
}

/** Overdue and the user asked us to raise it — send the follow-up alert. */
export async function raiseOverdueAlert({ userId }) {
  const active = await getActiveCheckIn();
  if (!userId || !active?.contactIds?.length) return { ok: false, sent: 0 };
  const where = active.placeLabel ? ` (last out at ${active.placeLabel})` : '';
  const body =
    `I haven't checked in\n` +
    `I said I'd be home by ${hhmm(active.dueAt)}${where} and I haven't marked myself safe. Please check on me.`;
  let sent = 0;
  for (const id of active.contactIds) {
    try { if (await MessageManager.send(userId, id, body)) sent++; } catch {}
  }
  return { ok: sent > 0, sent };
}

export async function cancelCheckIn() { await setActiveCheckIn(null); }

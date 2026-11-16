// ── Vibe Card ─────────────────────────────────────────────────────────────────
// THE one definition (A4). "Vibe Card" used to mean three drifting things —
// the profile tab, this share text, and an ad-hoc string DM built for itself.
// Canonical meaning: YOUR IDENTITY SUMMARY — handle, tier, vibe score,
// verified, crew — reputation earned by showing up, not followers (#87).
// EVERY surface that shares/renders a Vibe Card goes through this builder
// (profile share, DM attachment, anywhere new). The card markets the app:
// "real nights, verified, not posts." Pure; reuses the tested level ladder.
import { getVibeLevel } from './vibeLevel';
import { APP_WEB_URL } from '../constants/appUrl';

// /share/profile/<username> is the route that works: nginx proxies it to the
// og-meta Edge Function, which gives WhatsApp/X a real preview card and sends
// people on to /?profile=<id>. The old /u/<username> matched no route, so every
// shared card dropped people on the home page.
export function vibeCardLink(username) {
  return username ? `${APP_WEB_URL}/share/profile/${encodeURIComponent(username)}` : APP_WEB_URL;
}

export function buildVibeCardShareText(profile = {}, opts = {}) {
  const p = profile || {};
  const handle = p.username ? `${p.username}` : (p.display_name || 'A Viber');
  const score = Number(p.vibe_score) || 0;
  const level = getVibeLevel(score);

  const lines = [`🎫 ${handle} on The Gruvs`, `${level.name} · ${score} vibe pts`];

  const crew = Number(p.followers_count);
  if (Number.isFinite(crew) && crew > 0) lines.push(`👥 ${crew} in their crew`);
  if (p.is_verified) lines.push('✓ Verified');

  lines.push('— reputation earned by showing up, not posting.');
  lines.push(vibeCardLink(p.username));
  return lines.join('\n');
}

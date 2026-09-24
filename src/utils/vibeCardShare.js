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
  lines.push(p.username ? `${APP_WEB_URL}/u/${p.username}` : APP_WEB_URL);
  return lines.join('\n');
}

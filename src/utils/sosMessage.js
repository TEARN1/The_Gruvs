// ── SOS message ───────────────────────────────────────────────────────────────
// Make stored emergency contacts actionable. Builds a pre-filled "I need help"
// message + a WhatsApp/SMS deep link to a contact — no paid SMS API, just the
// device's own messaging apps. Honest scope: this OPENS your messaging app
// pre-addressed and pre-typed (assisted), it does not send silently. Pure.

export function buildSosMessage({ fromName, lat, lon } = {}) {
  const who = fromName ? `${fromName} needs help` : 'I need help';
  const lines = [`🆘 ${who}.`];
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    lines.push(`📍 My location: https://maps.google.com/?q=${lat},${lon}`);
  }
  lines.push('Sent from The Gruvs.');
  return lines.join('\n');
}

// Keep a leading +, strip everything else non-numeric.
export function normalizePhone(phone) {
  const s = String(phone || '').trim();
  const plus = s.startsWith('+') ? '+' : '';
  return plus + s.replace(/[^\d]/g, '');
}

export function whatsappLink(phone, message) {
  const digits = normalizePhone(phone).replace(/^\+/, ''); // wa.me wants no +
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message || '')}`;
}

export function smsLink(phone, message) {
  const num = normalizePhone(phone);
  if (!num) return null;
  return `sms:${num}?body=${encodeURIComponent(message || '')}`;
}

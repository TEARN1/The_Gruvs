// The PayFast rules both edge functions use (supabase/functions/_shared/payfastCore.js).
import crypto from 'crypto';
import {
  CHOSEN_MAX_CENTS,
  CHOSEN_MIN_CENTS,
  PayFastNotConfigured,
  SANDBOX_MERCHANT_ID,
  SANDBOX_PASSPHRASE,
  bookingPriceCents,
  checkNotification,
  chosenAmountCents,
  notificationSignatureOk,
  payfastConfig,
  safeReturnUrl,
  safeText,
  signatureString,
  ticketPriceCents,
  toCents,
} from '../supabase/functions/_shared/payfastCore';

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
const LIVE = { PAYFAST_MERCHANT_ID: '23456789', PAYFAST_MERCHANT_KEY: 'live_key_abc', PAYFAST_PASSPHRASE: 'a real passphrase' };

describe('payfastConfig', () => {
  test('test mode only when asked for', () => {
    expect(payfastConfig({ PAYFAST_SANDBOX: 'true' })).toMatchObject({ sandbox: true, merchantId: SANDBOX_MERCHANT_ID, passphrase: SANDBOX_PASSPHRASE });
    // Unset or anything else is live, and live without real details refuses.
    expect(() => payfastConfig({})).toThrow(PayFastNotConfigured);
    expect(() => payfastConfig({ PAYFAST_SANDBOX: 'yes' })).toThrow(PayFastNotConfigured);
  });

  test('live mode needs real merchant details and its own passphrase', () => {
    expect(payfastConfig(LIVE)).toEqual({ sandbox: false, merchantId: '23456789', merchantKey: 'live_key_abc', passphrase: 'a real passphrase' });
    expect(() => payfastConfig({ ...LIVE, PAYFAST_MERCHANT_ID: SANDBOX_MERCHANT_ID })).toThrow(PayFastNotConfigured);
    expect(() => payfastConfig({ ...LIVE, PAYFAST_PASSPHRASE: '' })).toThrow(/passphrase/i);
    expect(() => payfastConfig({ ...LIVE, PAYFAST_PASSPHRASE: SANDBOX_PASSPHRASE })).toThrow(/passphrase/i);
  });
});

describe('signatureString', () => {
  test('keeps field order, leaves out empty fields and the signature, adds the passphrase', () => {
    const s = signatureString({ merchant_id: '1', empty: '', item_name: 'VIP pass & drink', signature: 'x', amount: '150.00' }, 'pass phrase');
    expect(s).toBe('merchant_id=1&item_name=VIP+pass+%26+drink&amount=150.00&passphrase=pass+phrase');
  });

  test('a changed amount changes the signature', () => {
    const fields = { merchant_id: '1', m_payment_id: 'GRV-TIC-1', amount: '150.00' };
    expect(md5(signatureString(fields, 'p'))).not.toBe(md5(signatureString({ ...fields, amount: '1.00' }, 'p')));
  });
});

describe('notificationSignatureOk', () => {
  const fields = [
    ['m_payment_id', 'GRV-TIC-1'],
    ['payment_status', 'COMPLETE'],
    ['item_name', "Jazz night (Lerato's) VIP"],
    ['custom_str4', ''],
    ['amount_gross', '150.00'],
    ['merchant_id', '23456789'],
  ];
  const enc = (v) => encodeURIComponent(v).replace(/%20/g, '+');
  const php = (v) => enc(v).replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  const sign = (keepEmpty, e, pass, list = fields) =>
    md5([...list.filter(([, v]) => keepEmpty || v).map(([k, v]) => `${k}=${e(v)}`), `passphrase=${e(pass)}`].join('&'));

  test('accepts a real notice with empty fields kept or left out, in either encoding', () => {
    for (const keep of [true, false]) {
      for (const e of [enc, php]) {
        expect(notificationSignatureOk([...fields, ['signature', sign(keep, e, 'secret')]], 'secret', md5)).toBe(true);
      }
    }
  });

  test('refuses a notice without our passphrase, or with a changed amount', () => {
    expect(notificationSignatureOk([...fields, ['signature', sign(true, enc, 'guessed')]], 'secret', md5)).toBe(false);
    expect(notificationSignatureOk(fields, 'secret', md5)).toBe(false);
    const tampered = fields.map(([k, v]) => [k, k === 'amount_gross' ? '1.00' : v]);
    expect(notificationSignatureOk([...tampered, ['signature', sign(true, enc, 'secret')]], 'secret', md5)).toBe(false);
    expect(notificationSignatureOk([...fields, ['signature', sign(true, enc, '')]], '', md5)).toBe(false);
  });

  test('signed text drops characters JavaScript and PHP encode differently', () => {
    expect(safeText("Jazz night (Lerato's) VIP!", 100)).toBe('Jazz night Lerato\u2019s VIP');
    expect(safeText(undefined, 10)).toBe('');
  });
});

describe('prices come from the server', () => {
  test('a ticket is priced from the event tier, never from the browser', () => {
    const tiers = [{ id: 'gen', price: 0 }, { id: 'vip', name: 'VIP', price: '150' }, { id: 'odd', price: 'R150' }];
    expect(ticketPriceCents(tiers, 'vip')).toBe(15000);
    expect(ticketPriceCents(tiers, 'gen')).toBeNull(); // a free tier is booked, not paid
    expect(ticketPriceCents(tiers, 'odd')).toBeNull(); // not a plain amount
    expect(ticketPriceCents(tiers, 'missing')).toBeNull();
    expect(ticketPriceCents(null, 'vip')).toBeNull();
  });

  test('a booking is priced from the booking, and only once', () => {
    expect(bookingPriceCents({ amount_cents: 45000, payment_status: 'pending' })).toBe(45000);
    expect(bookingPriceCents({ amount_cents: 45000, payment_status: 'captured' })).toBeNull();
    expect(bookingPriceCents({ amount_cents: 0 })).toBeNull();
    expect(bookingPriceCents(null)).toBeNull();
  });

  test('a chosen amount stays within bounds', () => {
    expect(chosenAmountCents('50.00')).toBe(5000);
    expect(chosenAmountCents((CHOSEN_MIN_CENTS - 1) / 100)).toBeNull();
    expect(chosenAmountCents((CHOSEN_MAX_CENTS + 100) / 100)).toBeNull();
    expect(chosenAmountCents('-5')).toBeNull();
    expect(toCents('12.345')).toBeNaN();
  });

  test('the buyer is sent back only to our own site or app', () => {
    expect(safeReturnUrl('https://thegruvs.com/payment/success', 'fb')).toBe('https://thegruvs.com/payment/success');
    expect(safeReturnUrl('thegruvs://payment', 'fb')).toBe('thegruvs://payment');
    expect(safeReturnUrl('https://evil.example/thegruvs.com/', 'fb')).toBe('fb');
    expect(safeReturnUrl(undefined, 'fb')).toBe('fb');
  });
});

describe('checkNotification', () => {
  const config = payfastConfig(LIVE);
  const order = { m_payment_id: 'GRV-TIC-1', app: 'thegruvs', expected_amount_cents: 15000, fulfilled_at: null };
  const params = { merchant_id: '23456789', m_payment_id: 'GRV-TIC-1', amount_gross: '150.00', payment_status: 'COMPLETE' };

  test('a matching notice may fulfil the order', () => {
    expect(checkNotification({ params, config, order, signatureOk: true })).toEqual({ ok: true });
  });

  test('a forged or wrong notice is refused', () => {
    expect(checkNotification({ params, config, order, signatureOk: false })).toMatchObject({ ok: false, status: 400 });
    expect(checkNotification({ params: { ...params, merchant_id: SANDBOX_MERCHANT_ID }, config, order, signatureOk: true })).toMatchObject({ ok: false, reason: 'Wrong merchant' });
    expect(checkNotification({ params, config, order: null, signatureOk: true })).toMatchObject({ ok: false, status: 404 });
    expect(checkNotification({ params, config, order: { ...order, app: 'theresident' }, signatureOk: true })).toMatchObject({ ok: false });
  });

  test('paying less (or more) than the order is refused', () => {
    expect(checkNotification({ params: { ...params, amount_gross: '1.00' }, config, order, signatureOk: true })).toMatchObject({ ok: false, reason: 'Amount does not match the order' });
    expect(checkNotification({ params: { ...params, amount_gross: '150.01' }, config, order, signatureOk: true })).toMatchObject({ ok: false });
  });

  test('a resent notice for a fulfilled order does nothing twice', () => {
    expect(checkNotification({ params, config, order: { ...order, fulfilled_at: '2026-11-10T08:00:00Z' }, signatureOk: true })).toEqual({ ok: true, already: true });
  });
});

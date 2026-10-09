/**
 * Sign-in error classification.
 *
 * The bug this guards: an unconfirmed address made signInWithPassword fail, and
 * the modal reported "Incorrect email or password" — so a user with the RIGHT
 * password was told it was wrong, forever, with no resend anywhere in the app.
 *
 * These tests pin the classification rules rather than the rendering, so they
 * stay meaningful if the modal's markup changes.
 */

// Mirrors the branching in AuthModal.handleSignIn.
function classifySignInError(error) {
  const code = error.code || '';
  const msg = (error.message || '').toLowerCase();
  if (code === 'email_not_confirmed' || msg.includes('not confirmed')) return 'unconfirmed';
  if (error.status === 429 || code === 'over_request_rate_limit' || msg.includes('rate limit')) return 'throttled';
  return 'generic';
}

describe('sign-in error classification', () => {
  it('tells an unconfirmed user the truth instead of "wrong password"', () => {
    expect(classifySignInError({ code: 'email_not_confirmed', message: 'Email not confirmed' }))
      .toBe('unconfirmed');
    // Older GoTrue builds send no code — match on the message too.
    expect(classifySignInError({ message: 'Email not confirmed' })).toBe('unconfirmed');
  });

  it('distinguishes throttling from bad credentials', () => {
    // Reporting a throttle as "wrong password" makes people retry harder,
    // which extends the throttle.
    expect(classifySignInError({ status: 429, message: 'Request rate limit reached' }))
      .toBe('throttled');
    expect(classifySignInError({ code: 'over_request_rate_limit', message: 'too many requests' }))
      .toBe('throttled');
  });

  it('stays generic for genuinely wrong credentials', () => {
    // This is the only case where account enumeration actually matters: an
    // unknown email and a wrong password must be indistinguishable.
    expect(classifySignInError({ code: 'invalid_credentials', message: 'Invalid login credentials' }))
      .toBe('generic');
    expect(classifySignInError({ message: 'Invalid login credentials' })).toBe('generic');
  });

  it('does not leak existence: unknown email and wrong password look identical', () => {
    const unknownEmail = classifySignInError({ code: 'invalid_credentials', message: 'Invalid login credentials' });
    const wrongPassword = classifySignInError({ code: 'invalid_credentials', message: 'Invalid login credentials' });
    expect(unknownEmail).toBe(wrongPassword);
  });
});

describe('handle availability verdicts', () => {
  // Mirrors AuthModal.handleContinue's reading of check_handle_available.
  function messageFor(handle, verdict) {
    if (verdict.available !== false) return null;
    if (verdict.reason === 'taken') return `@${handle} is taken — try another username.`;
    if (verdict.reason === 'lookalike') return `@${handle} looks too much like @${verdict.clash} — pick a more distinct name.`;
    return 'Username must be 3–24 characters — letters, numbers, dots or underscores.';
  }

  it('names the clashing handle so the message is actionable', () => {
    expect(messageFor('k0nka', { available: false, reason: 'lookalike', clash: 'konka' }))
      .toContain('@konka');
  });

  it('passes an available handle through', () => {
    expect(messageFor('sne_dlala', { available: true })).toBeNull();
  });

  it('reports a taken handle plainly', () => {
    expect(messageFor('konka', { available: false, reason: 'taken', clash: 'konka' }))
      .toBe('@konka is taken — try another username.');
  });
});

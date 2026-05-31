/**
 * log — structured logger with PII scrubbing.
 * Guards: email/JWT/token are never logged in plain text.
 * setReporter() routes errors to a production reporter.
 */
import { log, setReporter } from '../src/utils/log';

// log.warn/log.info only fire in __DEV__ mode
global.__DEV__ = true;

describe('log scrubbing', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('scrubs email addresses from error messages', () => {
    log.error('test', 'user john.doe@example.com failed login');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[EMAIL]')
    );
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('john.doe@example.com')
    );
  });

  it('scrubs JWT tokens from error messages', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKx';
    log.error('auth', `token=${jwt}`);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[JWT]'));
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining(jwt));
  });

  it('scrubs sb- tokens from error messages', () => {
    const token = 'sb-abcdefghijklmnopqrstuvwxyz123456';
    log.error('auth', `refresh_token=${token}`);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[TOKEN]'));
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining(token));
  });

  it('preserves normal error messages without sensitive data', () => {
    log.error('fetch', 'network timeout after 5000ms');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('network timeout after 5000ms')
    );
  });

  it('includes context in the log output', () => {
    log.error('SportManagementPanel', 'something broke');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SportManagementPanel]')
    );
  });

  it('handles Error objects', () => {
    log.error('service', new Error('connection refused'));
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('connection refused')
    );
  });

  it('handles non-string, non-Error values gracefully', () => {
    expect(() => log.error('test', 42)).not.toThrow();
    expect(() => log.error('test', null)).not.toThrow();
    expect(() => log.error('test', { code: 500 })).not.toThrow();
  });
});

describe('setReporter', () => {
  afterEach(() => {
    setReporter(null); // reset after each test
    jest.restoreAllMocks();
  });

  it('calls the reporter with the error and context', () => {
    const reporter = jest.fn();
    setReporter(reporter);
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const err = new Error('boom');
    log.error('myContext', err);

    expect(reporter).toHaveBeenCalledWith(err, 'myContext');
  });

  it('wraps plain string errors in an Error before passing to reporter', () => {
    const reporter = jest.fn();
    setReporter(reporter);
    jest.spyOn(console, 'error').mockImplementation(() => {});

    log.error('ctx', 'plain string error');

    expect(reporter).toHaveBeenCalledWith(expect.any(Error), 'ctx');
  });

  it('does not crash if reporter throws', () => {
    setReporter(() => { throw new Error('reporter broken'); });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => log.error('ctx', 'msg')).not.toThrow();
  });
});

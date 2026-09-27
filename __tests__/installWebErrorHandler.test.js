/**
 * @jest-environment jsdom
 */
import { installWebErrorHandler } from '../src/utils/errorReporter';

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  console.error.mockRestore();
});

describe('installWebErrorHandler', () => {
  it('reports a window error through logError and logSecurityEvent', () => {
    const logError = jest.fn();
    const logSecurityEvent = jest.fn();
    installWebErrorHandler({ logError, logSecurityEvent });

    const err = new Error('boom in a handler');
    window.dispatchEvent(Object.assign(new Event('error'), { error: err, message: err.message }));

    expect(logError).toHaveBeenCalledWith('window:onerror', expect.any(Error));
    expect(logSecurityEvent).toHaveBeenCalledWith(null, 'JS_UNCAUGHT_ERROR', { message: 'boom in a handler' });
  });

  it('scrubs PII (email/token/key) from the reported message', () => {
    const logError = jest.fn();
    const logSecurityEvent = jest.fn();
    installWebErrorHandler({ logError, logSecurityEvent });

    const err = new Error('failed for user@example.com with sb-abcdefghijklmnopqrstuv');
    window.dispatchEvent(Object.assign(new Event('error'), { error: err, message: err.message }));

    const call = logSecurityEvent.mock.calls[0][2];
    expect(call.message).not.toContain('user@example.com');
    expect(call.message).toContain('[EMAIL]');
    expect(call.message).not.toContain('sb-abcdefghijklmnopqrstuv');
    expect(call.message).toContain('[TOKEN]');
  });

  it('reports an unhandled promise rejection through both sinks', () => {
    const logError = jest.fn();
    const logSecurityEvent = jest.fn();
    installWebErrorHandler({ logError, logSecurityEvent });

    const reason = new Error('promise blew up');
    const evt = new Event('unhandledrejection');
    Object.assign(evt, { reason });
    window.dispatchEvent(evt);

    expect(logError).toHaveBeenCalledWith('window:unhandledrejection', reason);
    expect(logSecurityEvent).toHaveBeenCalledWith(null, 'JS_UNHANDLED_REJECTION', { message: 'promise blew up' });
  });

  it('is a safe no-op when reporters are omitted', () => {
    expect(() => {
      installWebErrorHandler();
      window.dispatchEvent(Object.assign(new Event('error'), { error: new Error('x') }));
    }).not.toThrow();
  });

  it('is a no-op outside a browser environment', () => {
    const originalWindow = global.window;
    // Simulate a non-web runtime by removing window entirely.
    delete global.window;
    expect(() => installWebErrorHandler({ logError: jest.fn() })).not.toThrow();
    global.window = originalWindow;
  });
});

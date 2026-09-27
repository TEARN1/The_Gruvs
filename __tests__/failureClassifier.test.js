import { classify, recoveryFor, FailureKind, Recovery, RECOVERY_FOR_KIND } from '../src/utils/failureClassifier';

describe('classify', () => {
  it('classifies a 401 as AUTH_EXPIRED', () => {
    expect(classify({ status: 401, message: 'unauthorized' })).toBe(FailureKind.AUTH_EXPIRED);
  });

  it('classifies an expired JWT message as AUTH_EXPIRED', () => {
    expect(classify({ message: 'JWT expired' })).toBe(FailureKind.AUTH_EXPIRED);
  });

  it('classifies a missing column as SCHEMA_DRIFT', () => {
    expect(classify({ code: '42703', message: 'column x does not exist' })).toBe(FailureKind.SCHEMA_DRIFT);
  });

  it('classifies a PostgREST schema-cache code as SCHEMA_DRIFT', () => {
    expect(classify({ code: 'PGRST205' })).toBe(FailureKind.SCHEMA_DRIFT);
  });

  it('classifies a 403 as FATAL_INPUT', () => {
    expect(classify({ status: 403, message: 'permission denied' })).toBe(FailureKind.FATAL_INPUT);
  });

  it('classifies a network timeout as TRANSIENT', () => {
    expect(classify({ message: 'network timeout' })).toBe(FailureKind.TRANSIENT);
  });

  it('classifies an unrecognized error as UNKNOWN', () => {
    expect(classify({ message: 'something weird' })).toBe(FailureKind.UNKNOWN);
  });

  it('classifies as CHUNK_LOAD when context.lazyBoundary is set, regardless of message', () => {
    expect(classify(new Error('random'), { lazyBoundary: true })).toBe(FailureKind.CHUNK_LOAD);
  });

  it('classifies as VERSION_SKEW when context.versionSkew is set, taking priority over lazyBoundary', () => {
    expect(classify(new Error('random'), { lazyBoundary: true, versionSkew: true })).toBe(FailureKind.VERSION_SKEW);
  });
});

describe('recoveryFor / RECOVERY_FOR_KIND', () => {
  it('every FailureKind has a recovery action', () => {
    for (const kind of Object.values(FailureKind)) {
      expect(RECOVERY_FOR_KIND[kind]).toBeDefined();
      expect(Object.values(Recovery)).toContain(RECOVERY_FOR_KIND[kind]);
    }
  });

  it('AUTH_EXPIRED recovers via REAUTH', () => {
    expect(recoveryFor({ status: 401 })).toBe(Recovery.REAUTH);
  });

  it('CHUNK_LOAD recovers via RELOAD', () => {
    expect(recoveryFor(new Error('x'), { lazyBoundary: true })).toBe(Recovery.RELOAD);
  });

  it('FATAL_INPUT recovers via ABORT', () => {
    expect(recoveryFor({ status: 400 })).toBe(Recovery.ABORT);
  });

  it('SCHEMA_DRIFT recovers via FALLBACK', () => {
    expect(recoveryFor({ code: '42P01' })).toBe(Recovery.FALLBACK);
  });

  it('TRANSIENT recovers via RETRY', () => {
    expect(recoveryFor({ message: 'fetch failed' })).toBe(Recovery.RETRY);
  });
});

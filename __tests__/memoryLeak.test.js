import { SecurityService } from '../src/services/securityService';
import { FxService } from '../src/services/fxService';

const ITERATIONS = 1000;

function getHeapMB() {
  return Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100;
}

function forceGC() {
  if (global.gc) {
    global.gc();
  }
}

describe('Memory Leak Profiler', () => {
  it('runs core operations repeatedly and guarantees heap memory stability', async () => {
    console.log('\n🧠 Memory Leak Profile Runner (Jest Environment)');
    console.log(`Running ${ITERATIONS} cycles of core sanitization & validation operations...`);

    forceGC();
    const startMem = getHeapMB();
    console.log(`Starting Heap Memory: ${startMem} MB`);

    const timeStart = Date.now();

    for (let i = 0; i < ITERATIONS; i++) {
      // 1. Run XSS sanitization
      SecurityService.sanitizeContent(`Hello <script>alert(${i})</script> World!`);
      
      // 2. Run object redaction (creates new object states)
      SecurityService.redactObject({
        id: `user-${i}`,
        password: `secret-${i}`,
        email: `test-${i}@domain.com`,
      });

      // 3. Run client-side throttling check (inserts entries in a Map)
      SecurityService.rateLimitCheck(`key_${i % 100}`, { maxPerWindow: 2000, windowMs: 10000 });

      // 4. Run prototype pollution payloads
      SecurityService.sanitizePayload({
        i,
        __proto__: { hacked: true },
        nested: { constructor: { prototype: { val: i } } }
      });

      // 5. FX Rate checks
      FxService.rateTo('USD');
    }

    const elapsed = Date.now() - timeStart;
    forceGC();
    const endMem = getHeapMB();
    const diff = Math.round((endMem - startMem) * 100) / 100;

    console.log('\n📊 PROFILE RESULTS');
    console.log(`  Duration      : ${elapsed} ms`);
    console.log(`  End Heap      : ${endMem} MB`);
    console.log(`  Net Growth    : ${diff > 0 ? '+' : ''}${diff} MB`);

    if (global.gc) {
      // If GC is exposed, assert strict limits.
      // (a minor increase is fine due to engine caching, but should not grow out of bounds)
      expect(diff).toBeLessThan(5.0); 
    } else {
      console.warn('⚠️  Note: gc is not exposed in the test runner. Run with --expose-gc for strict checks.');
    }
  });
});

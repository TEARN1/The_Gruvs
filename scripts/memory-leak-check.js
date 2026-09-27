/**
 * scripts/memory-leak-check.js
 * Profiles Node.js heap memory growth by running the Jest memoryLeak test
 * with garbage collection exposed.
 *
 * Run: node --expose-gc scripts/memory-leak-check.js
 */
const { execSync } = require('child_process');
const path = require('path');

console.log('\n🧠 Launching Jest Memory Leak Profile...');

try {
  // Execute jest specifically for the memory leak test, exposing GC
  execSync('node --expose-gc node_modules/jest/bin/jest.js __tests__/memoryLeak.test.js --runInBand', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  console.log('✅ Memory profile execution completed successfully.');
  process.exit(0);
} catch (error) {
  console.error('❌ Memory profile test suite failed.');
  process.exit(1);
}

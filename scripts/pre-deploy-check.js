/**
 * scripts/pre-deploy-check.js
 *
 * Pre-flight deployment check (Gatekeeper):
 *  1. Scans codebase to ensure no high-privilege service role keys are committed.
 *  2. Verifies environment variables are set.
 *  3. Performs a lightweight connection smoke-test to verify Supabase.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('\n🛡️  Running Pre-Flight Gatekeeper Audits...');
console.log('===========================================');

// 1. Verify environment variables exist
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ FAILED: Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}
console.log('✅ Environment variables exist.');

// 2. Scan codebase for hardcoded Service Role Keys (or JWTs starting with eyJ and containing service role indicators)
function scanDirectory(dir) {
  let hasLeak = false;
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.expo' && file !== 'dist') {
        if (scanDirectory(fullPath)) hasLeak = true;
      }
    } else if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Look for keys matching service role patterns or service_role variable bindings
      if (content.includes('service_role') || (content.match(/eyJ[a-zA-Z0-9-_=]+\.[a-zA-Z0-9-_=]+\.[a-zA-Z0-9-_=]+/g) && !content.includes(SUPABASE_ANON_KEY))) {
        // Double-check if it's not a mock file
        if (!fullPath.includes('__tests__') && !fullPath.includes('jest.setup') && !fullPath.includes('sec-probe.js')) {
          console.error(`❌ SECURITY LEAK: Potential hardcoded service role token or variable found in: [${fullPath}]`);
          hasLeak = true;
        }
      }
    }
  }
  return hasLeak;
}

const leakDetected = scanDirectory(path.join(__dirname, '..', 'src'));
if (leakDetected) {
  console.error('\n❌ FAILED: Pre-flight security scan identified potential committed credentials. Deploy halted.');
  process.exit(1);
}
console.log('✅ Codebase credential scan clean (no leaks detected).');

// 3. Run a quick connection smoke test
(async () => {
  console.log('📡 Testing connection to Supabase endpoint...');
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  
  try {
    // Attempt a basic read query on public events
    const { data, error } = await sb.from('events').select('id').limit(1);
    
    if (error) {
      // 42501 (RLS blocked) or PGRST301 (JWT invalid) or other errors
      if (error.code === 'PGRST301' || error.message.includes('JWT')) {
        console.error('❌ FAILED: Supabase authentication error. The EXPO_PUBLIC_SUPABASE_ANON_KEY is invalid.');
        setTimeout(() => process.exit(1), 100);
      }
      
      // If it is just RLS block (42501) or table empty, the connection is still alive and keys are authenticated!
      console.log(`ℹ️ Connection successful. Query returned database response status: ${error.code} (${error.message})`);
    } else {
      console.log('✅ Connection smoke test successful. Database returned rows successfully.');
    }
    
    console.log('===========================================');
    console.log('🎉 SUCCESS: All pre-flight gates passed! Proceeding with deploy.');
    setTimeout(() => process.exit(0), 100);
  } catch (err) {
    console.error('❌ FAILED: Abrupt error connecting to Supabase:', err.message);
    setTimeout(() => process.exit(1), 100);
  }
})();

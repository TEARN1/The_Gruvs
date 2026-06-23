const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const readline = require('readline');
require('dotenv').config();

const SQL_FILE_PATH = path.join(__dirname, '..', 'supabase', 'queries', 'schema_part_4.sql');

async function main() {
  console.log('🔌  Supabase Live Database Patch Deployer');
  console.log('==========================================');

  let dbUrl = process.env.SUPABASE_PRODUCTION_DB_URL || process.env.DATABASE_URL;

  if (!dbUrl) {
    // Try reading from .env manually just in case dotenv didn't pick it up or it's formatted differently
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/^(SUPABASE_PRODUCTION_DB_URL|DATABASE_URL)=(.*)$/m);
      if (match) {
        dbUrl = match[2].trim().replace(/['"]/g, '');
      }
    }
  }

  if (!dbUrl) {
    console.log('No database connection URL found in environment variables (SUPABASE_PRODUCTION_DB_URL or DATABASE_URL).');
    console.log('You can find your connection string in the Supabase Dashboard under:');
    console.log('Settings -> Database -> Connection string -> URI (use the Transaction/Session Pooler or Direct connection URL).');
    console.log('');
    dbUrl = await askQuestion('Please enter your database connection URL: ');
  }

  dbUrl = dbUrl.trim();
  if (!dbUrl) {
    console.error('❌ Error: Database URL cannot be empty.');
    process.exit(1);
  }

  console.log('\n📖  Reading schema patch from schema_part_4.sql...');
  if (!fs.existsSync(SQL_FILE_PATH)) {
    console.error(`❌ Error: Schema file not found at ${SQL_FILE_PATH}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(SQL_FILE_PATH, 'utf8');
  // Find where the patch section starts
  const patchStartToken = 'CREATE OR REPLACE FUNCTION public.is_admin';
  const startIndex = sqlContent.indexOf(patchStartToken);

  if (startIndex === -1) {
    console.error(`❌ Error: Could not find the start token "${patchStartToken}" in the schema file.`);
    process.exit(1);
  }

  const patchSql = sqlContent.slice(startIndex);
  console.log(`✅  Found patch SQL (~${patchSql.split('\n').length} lines).`);

  console.log('\n📡  Connecting to the database...');
  const client = new Client({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false // Supabase requires SSL, this ensures it works on standard Node setups
    }
  });

  try {
    await client.connect();
    console.log('✅  Connected successfully.');

    console.log('🚀  Executing SQL patch...');
    await client.query(patchSql);
    console.log('🎉  SUCCESS: Database patch executed and applied successfully!');

    // Let's run a quick verification select to verify is_admin is deployed
    const verifyRes = await client.query("SELECT has_function_privilege('public.is_admin(uuid)', 'execute') as has_priv;");
    if (verifyRes.rows[0]?.has_priv) {
      console.log('✅  Verified: public.is_admin function is live and executable.');
    }
  } catch (err) {
    console.error('❌  FAILED: Error executing database patch:');
    console.error(err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans);
  }));
}

main().catch(console.error);

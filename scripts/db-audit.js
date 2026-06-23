const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const readline = require('readline');
require('dotenv').config();

const SQL_FILE_PATH = path.join(__dirname, '..', 'supabase', 'queries', 'audit_db_state.sql');

async function main() {
  console.log('🔍  Supabase Live Database Schema Audit');
  console.log('========================================');

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

  console.log('\n📖  Reading audit query from audit_db_state.sql...');
  if (!fs.existsSync(SQL_FILE_PATH)) {
    console.error(`❌ Error: Schema file not found at ${SQL_FILE_PATH}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(SQL_FILE_PATH, 'utf8');

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

    console.log('🚀  Executing drift audit...');
    const res = await client.query(sqlContent);
    
    if (res.rows.length === 0) {
      console.log('\n🎉  CONGRATULATIONS: No schema drift, duplicates, or missing objects detected! Database matches canonical schema.');
    } else {
      console.log('\n📊  AUDIT FINDINGS:\n');
      
      const tableData = res.rows.map(row => ({
        Severity: row.severity || row.coalesce || 'INFO',
        Category: row.category || '',
        Object: row.object || '',
        Detail: (row.detail || '').substring(0, 80) + ((row.detail || '').length > 80 ? '...' : '')
      }));

      console.table(tableData);
      
      const highAlerts = res.rows.filter(r => (r.severity || r.coalesce) === 'HIGH');
      if (highAlerts.length > 0) {
        console.log(`\n⚠️  Alert: Found ${highAlerts.length} HIGH severity issues. Run 'npm run db:patch' to fix major RLS policies, bucket configs, and tables.`);
      }
    }
  } catch (err) {
    console.error('❌  FAILED: Error running database audit:');
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

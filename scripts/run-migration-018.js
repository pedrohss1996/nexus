require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { query } = require('../config/database');

async function run() {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', '018_assinaturas_govbr.sql'),
    'utf8'
  );
  console.log('Executando migration 018...');
  await query(sql);
  console.log('Migration 018 executada com sucesso.');
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });

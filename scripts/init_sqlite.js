#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

(async () => {
  const dbPath = path.join(__dirname, '..', 'data', 'driplab.sqlite');
  const sqlPath = path.join(__dirname, '..', 'database', 'schema.sql');

  // Ler schema original
  let raw;
  try {
    raw = fs.readFileSync(sqlPath, 'utf8');
  } catch (e) {
    console.error('Não foi possível ler schema.sql:', e.message);
    process.exit(1);
  }

  // Transformações simples para SQLite
  const transformed = raw
    .replace(/SERIAL/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/BIGINT/g, 'INTEGER')
    .replace(/BOOLEAN/g, 'INTEGER') // 0 / 1
    .replace(/DEFAULT true/g, 'DEFAULT 1')
    .replace(/DEFAULT false/g, 'DEFAULT 0')
    .replace(/ENUM\([^\)]+\)/g, 'TEXT')
    .replace(/ON UPDATE CURRENT_TIMESTAMP/g, '')
    .replace(/;;/g, ';');

  // Cria/abre o SQLite
  let db;
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
  } catch (e) {
    console.error('Erro ao abrir banco SQLite:', e.message);
    process.exit(1);
  }

  // Executa todo o script (split by ';')
  const statements = transformed
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    try {
      await db.exec(stmt + ';');
    } catch (e) {
      console.error('Erro ao executar:', stmt, '\n', e.message);
      // continua com o próximo
    }
  }

  console.log('Banco SQLite criado em', dbPath);
  await db.close();
})();


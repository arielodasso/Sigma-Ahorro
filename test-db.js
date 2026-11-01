try {
  const path = require('path');
  const fs = require('fs');
  const BetterSqlite3 = require('better-sqlite3');
  
  const filePath = path.join(process.cwd(), '.data', 'sigma-ahorro.db');
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  console.log('Directory created:', dir);
  
  const sqlite = new BetterSqlite3(filePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  
  const schema = `CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TEXT
  )`;
  sqlite.exec(schema);
  console.log('Schema executed');
  
  // BetterSqlite3 uses .prepare().get() for queries
  const stmt = sqlite.prepare('SELECT COUNT(*) AS count FROM users');
  const row = stmt.get();
  console.log('Count:', row);
  
  // Seed currencies
  const CURRENCIES = {
    ARS: { code: 'ARS', name: 'Peso argentino', symbol: '$', decimals: 2 },
    USD: { code: 'USD', name: 'Dólar estadounidense', symbol: '$', decimals: 2 },
    EUR: { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 }
  };
  
  for (const code of Object.keys(CURRENCIES)) {
    const meta = CURRENCIES[code];
    try {
      const insertStmt = sqlite.prepare(
        "INSERT INTO currencies (code, name, symbol, decimals, active) VALUES (?, ?, ?, ?, 1) ON CONFLICT (code) DO NOTHING"
      );
      insertStmt.run(meta.code, meta.name, meta.symbol, meta.decimals);
      console.log('Currency inserted:', code);
    } catch (e) {
      console.error('Error inserting currency', code, ':', e.message);
    }
  }
  
  sqlite.close();
  console.log('Success!');
} catch (e) {
  console.error('Error:', e.message);
  console.error('Stack:', e.stack);
}
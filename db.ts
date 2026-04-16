import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('data.db');

let db: Database;

export async function getDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_lower TEXT NOT NULL UNIQUE,
      gender TEXT,
      gender_probability REAL,
      sample_size INTEGER,
      age INTEGER,
      age_group TEXT,
      country_id TEXT,
      country_probability REAL,
      created_at TEXT
    )
  `);

  saveDb();
  return db;
}

export function saveDb() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}
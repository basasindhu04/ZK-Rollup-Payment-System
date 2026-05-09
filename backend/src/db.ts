import { Pool } from "pg";
import fs from "fs";
import path from "path";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("[DB] Running migrations...");
    const migrationsDir = path.join(__dirname, "../migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`[DB] Running migration: ${file}`);
      await client.query(sql);
    }
    console.log("[DB] Migrations complete.");
  } finally {
    client.release();
  }
}

export async function waitForDB(retries = 15, delay = 3000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      console.log("[DB] Connected successfully.");
      return;
    } catch (err) {
      console.log(`[DB] Waiting for database... (${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("[DB] Could not connect to database after retries.");
}

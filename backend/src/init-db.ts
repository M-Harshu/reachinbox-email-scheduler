import { pool } from "./db";

async function initDatabase() {
  try {
    // --------------------------------------------------
    // EMAILS TABLE
    // --------------------------------------------------

    await pool.query(`
      CREATE TABLE IF NOT EXISTS emails (
        id SERIAL PRIMARY KEY,
        recipient TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        scheduled_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled',
        sent_at TIMESTAMPTZ NULL
      );
    `);

    // --------------------------------------------------
    // APP SETTINGS TABLE
    // --------------------------------------------------

    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    console.log("Database tables created successfully ✅");
  } catch (error) {
    console.error(
      "Database initialization failed ❌",
      error
    );
  } finally {
    await pool.end();
  }
}

initDatabase();
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i === -1) continue;
  const k = line.slice(0, i).trim();
  const v = line.slice(i + 1).trim();
  if (!process.env[k]) process.env[k] = v;
}

const sql = fs.readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8");

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL?.replace(/[?&]sslmode=[^&]+/, ""),
  ssl: { rejectUnauthorized: false },
});

await client.connect();
await client.query(sql);
await client.end();
console.log("Sanket schema applied.");

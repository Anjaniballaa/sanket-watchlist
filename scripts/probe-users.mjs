import fs from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const connectionString = (process.env.DATABASE_URL ?? "").replace(/[?&]sslmode=[^&]+/g, "");
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query("create unique index if not exists users_email_idx on users (email)");
const probe = await client.query("select column_name from information_schema.columns where table_schema='public' and table_name='users'");
console.log("users columns", probe.rows.map((r) => r.column_name));
const ins = await client.query(
  `insert into users (email, name) values ('sanket-probe@example.com', 'probe')
   on conflict (email) do update set name = excluded.name
   returning id`,
);
console.log("upsert ok", ins.rows[0]);
await client.query("delete from users where email = 'sanket-probe@example.com'");
await client.end();

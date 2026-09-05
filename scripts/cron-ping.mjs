const url = process.env.SANKET_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET ?? "";
const res = await fetch(`${url}/api/cron/refresh`, {
  headers: secret ? { Authorization: `Bearer ${secret}` } : {},
});
console.log(res.status, await res.text());
if (!res.ok) process.exit(1);

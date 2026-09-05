import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = (process.env.DATABASE_URL ?? "").replace(/[?&]sslmode=[^&]+/g, "");
    if (!connectionString) throw new Error("DATABASE_URL missing");
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 4,
    });
  }
  return pool;
}

export async function upsertAuthUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<string> {
  const email = input.email.toLowerCase();
  const result = await getPool().query<{ id: string }>(
    `insert into users (email, name, image)
     values ($1, $2, $3)
     on conflict (email) do update set
       name = excluded.name,
       image = excluded.image
     returning id`,
    [email, input.name ?? null, input.image ?? null],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error("user upsert returned no id");
  return id;
}

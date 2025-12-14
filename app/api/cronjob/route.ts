import knex from "knex";
import axios from "axios";

const knexInstance = knex({
  client: "cockroachdb",
  connection: {
    host: process.env.CROCKROACH_HOST,
    database: process.env.CROCKROACH_DATABASE,
    user: process.env.CROCKROACH_USER,
    password: process.env.CROCKROACH_PASSWORD,
    port: Number(process.env.CROCKROACH_PORT) || 26257,
    ssl: true,
  },
});

export async function GET(request: Request) {
  const messages = await knexInstance.raw(`
     SELECT id
            FROM jobs
            WHERE
                (
                    status = 'pending'
                    OR (status = 'in_progress' AND visible_at <= now())
                )
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        
  `);

  if (messages.rows.length === 0) {
    console.log("no messages found");
    return Response.json({ ok: true });
  }

  const totalWorkers = (
    await knexInstance.raw(`
            WITH next_workers AS (
            SELECT id
            FROM workers as w
            WHERE
                status = 'idle'
            LIMIT 1000
            FOR UPDATE SKIP LOCKED
        )
        UPDATE workers
        SET status = 'working',
            updated_at = now()
        FROM next_workers
        WHERE workers.id = next_workers.id   
        RETURNING workers.id;
  `)
  ).rows;

  for (const worker of totalWorkers) {
    console.log("passed on here");
    axios.post(
      "https://consumer-1million-message-vercel-fu.vercel.app/api/consumer",
      worker
    );
  }
  return Response.json({ ok: true });
}

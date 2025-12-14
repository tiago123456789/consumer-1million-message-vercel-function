import {
  Consumer,
  CrockroachQueueDriver,
} from "crockroachdb-queue-producer-consumer";
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

const queueDriver = new CrockroachQueueDriver(knexInstance, "pgmq");

export async function POST(request: Request) {
  const body = request.body;

  const consumer = new Consumer(
    {
      queueName: "jobs",
      visibilityTime: 30,
      consumeType: "read",
      poolSize: 10,
      timeMsWaitBeforeNextPolling: 1000,
      enabledPolling: false,
      queueNameDlq: "jobs_dlq",
      totalRetriesBeforeSendToDlq: 2,
    },
    async function (message: { [key: string]: any }, signal): Promise<void> {
      await axios.post(process.env.CONSUMER_URL!, { message: message });
    },
    queueDriver
  );

  consumer.on("send-to-dlq", (message: { [key: string]: any }) => {
    console.log("Send to DLQ =>", message);
  });

  consumer.on("error", (err: Error) => {
    console.error("Error consuming message:", err.message);
  });

  await consumer.start();
  await knexInstance.raw(
    `
      update workers set status = 'idle',  updated_at = now()
      where id = ?
    `,
    body.id
  );

  return Response.json({ ok: true });
}

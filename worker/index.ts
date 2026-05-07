// Background worker. Runs as the `scope-check-worker` Render service.
// Polls the `jobs` table, claims work atomically, dispatches to handlers.

import { createClient } from "@supabase/supabase-js";
import { makeExtractDocumentHandler } from "./handlers/extract-document.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 5000);
const HEARTBEAT_MS = 30_000;
const WORKER_ID = `${process.env.RENDER_INSTANCE_ID ?? "local"}-${process.pid}`;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "[worker] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Job = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  project_id: string | null;
};

// kind -> handler(job). New handlers register here.
const handlers: Record<string, (job: Job) => Promise<unknown>> = {
  extract_document: makeExtractDocumentHandler(supabase),
};

let running = true;
let lastHeartbeat = 0;

function shutdown(reason: string) {
  if (!running) return;
  running = false;
  console.log(`[worker ${WORKER_ID}] shutting down (${reason})`);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function completeJob(id: string, result: unknown) {
  await supabase
    .from("jobs")
    .update({
      status: "completed",
      result: (result ?? null) as never,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);
}

async function failJob(job: Job, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const giveUp = job.attempts >= job.max_attempts;
  const update: Record<string, unknown> = {
    status: giveUp ? "failed" : "queued",
    last_error: message.slice(0, 2000),
    locked_at: null,
    locked_by: null,
  };
  if (giveUp) {
    update.completed_at = new Date().toISOString();
  } else {
    // Exponential backoff: 30s, 2m, 8m...
    const delaySec = 30 * Math.pow(4, job.attempts - 1);
    update.run_after = new Date(Date.now() + delaySec * 1000).toISOString();
  }
  await supabase.from("jobs").update(update).eq("id", job.id);
  console.error(
    `[worker] job ${job.id} ${giveUp ? "FAILED permanently" : "failed, will retry"}: ${message}`,
  );
}

async function tick(): Promise<boolean> {
  const { data, error } = await supabase.rpc("claim_next_job", {
    worker_id: WORKER_ID,
    job_kinds: null,
  });

  if (error) {
    console.error(`[worker] claim error: ${error.message}`);
    return false;
  }
  if (!data) return false;

  const job = data as Job;
  console.log(`[worker] claimed job ${job.id} kind=${job.kind}`);

  const handler = handlers[job.kind];
  if (!handler) {
    await failJob(
      { ...job, attempts: job.max_attempts },
      `No handler registered for job kind "${job.kind}".`,
    );
    return true;
  }

  try {
    const result = await handler(job);
    await completeJob(job.id, result);
    console.log(`[worker] job ${job.id} complete`);
  } catch (err) {
    await failJob(job, err);
  }
  return true;
}

async function loop() {
  console.log(
    `[worker ${WORKER_ID}] starting; poll=${POLL_MS}ms handlers=[${Object.keys(handlers).join(",") || "none"}]`,
  );
  while (running) {
    let didWork = false;
    try {
      didWork = await tick();
    } catch (err) {
      console.error("[worker] tick crash:", err);
    }
    if (!didWork) {
      const now = Date.now();
      if (now - lastHeartbeat > HEARTBEAT_MS) {
        console.log(`[worker ${WORKER_ID}] idle`);
        lastHeartbeat = now;
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
  console.log(`[worker ${WORKER_ID}] stopped cleanly`);
  process.exit(0);
}

loop();

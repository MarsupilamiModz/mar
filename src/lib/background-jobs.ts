type Job = () => Promise<void>;

export type BackgroundJobKind =
  | "upload"
  | "virustotal"
  | "image"
  | "audio"
  | "banner"
  | "email"
  | "generic";

const queue: Job[] = [];
let draining = false;

async function drainQueue() {
  if (draining) return;
  draining = true;
  while (queue.length > 0) {
    const job = queue.shift();
    if (!job) continue;
    try {
      await job();
    } catch (err) {
      console.error("[background-jobs]", err);
    }
  }
  draining = false;
}

/** Fire-and-forget background work — batches via microtask queue. */
export function enqueueBackgroundJob(job: Job, kind: BackgroundJobKind = "generic") {
  queue.push(async () => {
    const started = Date.now();
    try {
      await job();
    } finally {
      if (process.env.NODE_ENV === "development") {
        console.info(`[background-jobs:${kind}] ${Date.now() - started}ms`);
      }
    }
  });
  if (!draining) {
    queueMicrotask(() => void drainQueue());
  }
}

export function enqueueUploadJob(job: Job) {
  enqueueBackgroundJob(job, "upload");
}

export function enqueueImageProcessingJob(job: Job) {
  enqueueBackgroundJob(job, "image");
}

export function enqueueScanJob(job: Job) {
  enqueueBackgroundJob(job, "virustotal");
}

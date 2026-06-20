type Job = () => Promise<void>;

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
export function enqueueBackgroundJob(job: Job) {
  queue.push(job);
  if (!draining) {
    queueMicrotask(() => void drainQueue());
  }
}

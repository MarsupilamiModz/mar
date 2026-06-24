import { enqueueBackgroundJob } from "@/lib/background-jobs";

export type UploadJobPayload = {
  kind: "upload-process" | "scan-queue" | "media-repair" | "translation";
  entityId: string;
  userId?: string;
  meta?: Record<string, unknown>;
};

function redisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL);
}

/** Queue upload/post-processing work without blocking the HTTP request. */
export function enqueueUploadJob(payload: UploadJobPayload, handler: () => Promise<void>) {
  if (redisConfigured()) {
    // BullMQ can be wired here when REDIS_URL is set — for now use in-process queue.
    console.info("[job-queue] enqueue", payload.kind, payload.entityId);
  }
  enqueueBackgroundJob(handler);
}

export function getQueueStatus() {
  return {
    backend: redisConfigured() ? "redis-ready" : "in-process",
    redisConfigured: redisConfigured(),
  };
}

import { prisma } from "@/lib/db";

const SLOW_QUERY_MS = 200;
const SLOW_API_MS = 500;
const PERF_KEY = "platform_perf_metrics";
const MAX_SAMPLES = 200;

export type PerfSample = {
  id: string;
  kind: "query" | "api" | "action";
  label: string;
  durationMs: number;
  at: string;
};

export async function recordPerfSample(
  kind: PerfSample["kind"],
  label: string,
  durationMs: number
) {
  const threshold = kind === "query" ? SLOW_QUERY_MS : SLOW_API_MS;
  if (durationMs < threshold) return;

  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: PERF_KEY } });
    const existing = (row?.value as PerfSample[] | undefined) ?? [];
    const entry: PerfSample = {
      id: crypto.randomUUID(),
      kind,
      label,
      durationMs: Math.round(durationMs),
      at: new Date().toISOString(),
    };
    await prisma.siteSetting.upsert({
      where: { key: PERF_KEY },
      create: { key: PERF_KEY, value: [entry] as object },
      update: { value: [entry, ...existing].slice(0, MAX_SAMPLES) as object },
    });
  } catch {
    /* non-blocking */
  }
}

export async function listPerfSamples(limit = 50): Promise<PerfSample[]> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: PERF_KEY } });
    return ((row?.value as PerfSample[] | undefined) ?? []).slice(0, limit);
  } catch {
    return [];
  }
}

export async function timedQuery<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    void recordPerfSample("query", label, performance.now() - start);
  }
}

export async function timedApi<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    void recordPerfSample("api", label, performance.now() - start);
  }
}

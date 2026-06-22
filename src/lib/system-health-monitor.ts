import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/db";
import { checkDbHealth } from "@/lib/db";
import { getEmailSettingsPublic } from "@/lib/email/settings";
import { getMalwareScannerSettingsRaw } from "@/lib/malware-settings";
import { listPlatformErrors } from "@/lib/platform-log";
import { listPerfSamples, type PerfSample } from "@/lib/monitoring/perf";
import { getR2ConfigStatus } from "@/lib/r2-config";
import { STORAGE } from "@/lib/storage";
import { getVirusTotalQuota } from "@/lib/security/quota";

export type HealthLevel = "healthy" | "warning" | "critical";

export type HealthServiceId =
  | "database"
  | "api"
  | "upload"
  | "storage"
  | "email"
  | "discord_oauth"
  | "virustotal"
  | "r2"
  | "platform";

export type PlatformHealthMetrics = {
  activeUsers24h: number;
  uploadQueue: number;
  virusTotalQueue: number;
  failedUploads24h: number;
  failedPayments24h: number;
  failedReports24h: number;
  trackedStorageMb: number;
  mediaFiles: number;
  dbLatencyMs: number;
};

export type HealthServiceStatus = {
  id: HealthServiceId;
  name: string;
  level: HealthLevel;
  detail: string;
  metrics?: Record<string, string | number | boolean | null>;
};

export type SystemHealthSnapshot = {
  overall: HealthLevel;
  services: HealthServiceStatus[];
  platform?: PlatformHealthMetrics;
  slowQueries?: PerfSample[];
  checkedAt: string;
};

function worstLevel(levels: HealthLevel[]): HealthLevel {
  if (levels.includes("critical")) return "critical";
  if (levels.includes("warning")) return "warning";
  return "healthy";
}

async function probeR2Bucket(): Promise<{ ok: boolean; detail: string }> {
  const status = getR2ConfigStatus();
  if (!status.configured) {
    return { ok: false, detail: `Missing: ${status.missing.join(", ")}` };
  }

  try {
    const client = new S3Client({
      region: "auto",
      endpoint: status.endpoint!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    await client.send(new HeadBucketCommand({ Bucket: STORAGE.bucket }));
    return { ok: true, detail: `Bucket "${STORAGE.bucket}" reachable` };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "Bucket unreachable",
    };
  }
}

async function probeDatabase(): Promise<HealthServiceStatus> {
  const started = Date.now();
  const result = await checkDbHealth();
  const latencyMs = Date.now() - started;

  if (!result.ok) {
    return {
      id: "database",
      name: "Database",
      level: "critical",
      detail: result.detail ?? "Connection failed",
      metrics: { latencyMs },
    };
  }

  if (latencyMs > 2000) {
    return {
      id: "database",
      name: "Database",
      level: "warning",
      detail: `Connected but slow (${latencyMs}ms)`,
      metrics: { latencyMs },
    };
  }

  return {
    id: "database",
    name: "Database",
    level: "healthy",
    detail: `PostgreSQL connected (${latencyMs}ms)`,
    metrics: { latencyMs },
  };
}

async function probeApi(): Promise<HealthServiceStatus> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const errors = await listPlatformErrors(100);
  const recentErrors = errors.filter((entry) => new Date(entry.createdAt) >= hourAgo);

  let supabaseOk = false;
  let supabaseDetail = "Reachable";

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.auth.getUser();
    supabaseOk = !error;
    supabaseDetail = error ? error.message : "Supabase Auth reachable";
  } catch (err) {
    supabaseDetail = err instanceof Error ? err.message : "Supabase unreachable";
  }

  if (!supabaseOk) {
    return {
      id: "api",
      name: "API",
      level: "critical",
      detail: supabaseDetail,
      metrics: { recentErrors: recentErrors.length },
    };
  }

  if (recentErrors.length >= 20) {
    return {
      id: "api",
      name: "API",
      level: "critical",
      detail: `${recentErrors.length} platform errors in the last hour`,
      metrics: { recentErrors: recentErrors.length },
    };
  }

  if (recentErrors.length >= 5) {
    return {
      id: "api",
      name: "API",
      level: "warning",
      detail: `${recentErrors.length} platform errors in the last hour`,
      metrics: { recentErrors: recentErrors.length },
    };
  }

  return {
    id: "api",
    name: "API",
    level: "healthy",
    detail: "Supabase Auth and platform APIs operational",
    metrics: { recentErrors: recentErrors.length },
  };
}

async function probeUpload(): Promise<HealthServiceStatus> {
  const r2 = getR2ConfigStatus();
  const [inProgress, stale] = await Promise.all([
    prisma.storageUploadSession.count({ where: { status: "IN_PROGRESS" } }).catch(() => 0),
    prisma.storageUploadSession
      .count({
        where: {
          status: "IN_PROGRESS",
          createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
        },
      })
      .catch(() => 0),
  ]);

  if (!r2.configured) {
    return {
      id: "upload",
      name: "Upload",
      level: "critical",
      detail: "R2 multipart pipeline not configured",
      metrics: { inProgress, stale },
    };
  }

  if (stale > 0 || inProgress >= 20) {
    return {
      id: "upload",
      name: "Upload",
      level: "critical",
      detail:
        stale > 0
          ? `${stale} stale upload session(s) over 1 hour old`
          : `${inProgress} uploads currently in progress`,
      metrics: { inProgress, stale },
    };
  }

  if (inProgress >= 5) {
    return {
      id: "upload",
      name: "Upload",
      level: "warning",
      detail: `${inProgress} uploads in progress`,
      metrics: { inProgress, stale },
    };
  }

  return {
    id: "upload",
    name: "Upload",
    level: "healthy",
    detail: "Multipart upload pipeline ready",
    metrics: { inProgress, stale },
  };
}

async function probeStorage(): Promise<HealthServiceStatus> {
  const [bytesAgg, mediaCount, inProgress] = await Promise.all([
    prisma.modVersion.aggregate({ _sum: { fileSize: true } }).catch(() => ({ _sum: { fileSize: null } })),
    prisma.mediaFile.count().catch(() => 0),
    prisma.storageUploadSession.count({ where: { status: "IN_PROGRESS" } }).catch(() => 0),
  ]);

  const bytes = Number(bytesAgg._sum.fileSize ?? 0);
  const mb = bytes > 0 ? Math.round(bytes / 1024 / 1024) : 0;

  if (bytes === 0 && mediaCount === 0) {
    return {
      id: "storage",
      name: "Storage",
      level: "warning",
      detail: "No tracked file storage data yet",
      metrics: { trackedMb: mb, mediaFiles: mediaCount, inProgress },
    };
  }

  return {
    id: "storage",
    name: "Storage",
    level: "healthy",
    detail: `${mb} MB tracked across mod versions · ${mediaCount} media files`,
    metrics: { trackedMb: mb, mediaFiles: mediaCount, inProgress },
  };
}

async function probeEmail(): Promise<HealthServiceStatus> {
  const [emailSettings, pending, failedRecent] = await Promise.all([
    getEmailSettingsPublic(),
    prisma.emailLog.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.emailLog
      .count({
        where: {
          status: "FAILED",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      })
      .catch(() => 0),
  ]);

  const resendFallback = Boolean(process.env.RESEND_API_KEY);
  const configured = emailSettings.configured || resendFallback;

  if (!configured) {
    return {
      id: "email",
      name: "Email",
      level: "critical",
      detail: "No SMTP or Resend provider configured",
      metrics: { pending, failedRecent },
    };
  }

  if (failedRecent >= 10) {
    return {
      id: "email",
      name: "Email",
      level: "critical",
      detail: `${failedRecent} failed emails in the last 24 hours`,
      metrics: { pending, failedRecent },
    };
  }

  if (!emailSettings.configured && resendFallback) {
    return {
      id: "email",
      name: "Email",
      level: "warning",
      detail: "Using Resend fallback — SMTP not fully configured",
      metrics: { pending, failedRecent },
    };
  }

  if (pending > 0 || failedRecent > 0) {
    return {
      id: "email",
      name: "Email",
      level: "warning",
      detail:
        pending > 0
          ? `${pending} email(s) pending delivery`
          : `${failedRecent} failed email(s) in 24h`,
      metrics: { pending, failedRecent },
    };
  }

  return {
    id: "email",
    name: "Email",
    level: "healthy",
    detail: emailSettings.configured ? "SMTP configured and delivering" : "Resend configured",
    metrics: { pending, failedRecent },
  };
}

async function probeDiscordOAuth(): Promise<HealthServiceStatus> {
  const hasClient = Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
  const hasBot = Boolean(process.env.DISCORD_BOT_TOKEN);
  const hasGuild = Boolean(process.env.DISCORD_GUILD_ID);

  if (!hasClient) {
    return {
      id: "discord_oauth",
      name: "Discord OAuth",
      level: "critical",
      detail: "Missing DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET",
      metrics: { botConfigured: hasBot, guildConfigured: hasGuild },
    };
  }

  if (hasBot) {
    try {
      const res = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        cache: "no-store",
      });
      if (!res.ok) {
        return {
          id: "discord_oauth",
          name: "Discord OAuth",
          level: "warning",
          detail: `OAuth configured · bot token rejected (${res.status})`,
          metrics: { botConfigured: true, guildConfigured: hasGuild },
        };
      }
    } catch (err) {
      return {
        id: "discord_oauth",
        name: "Discord OAuth",
        level: "warning",
        detail: err instanceof Error ? err.message : "Discord API unreachable",
        metrics: { botConfigured: true, guildConfigured: hasGuild },
      };
    }
  }

  if (!hasBot || !hasGuild) {
    return {
      id: "discord_oauth",
      name: "Discord OAuth",
      level: "warning",
      detail: "OAuth client configured · bot or guild sync not fully configured",
      metrics: { botConfigured: hasBot, guildConfigured: hasGuild },
    };
  }

  return {
    id: "discord_oauth",
    name: "Discord OAuth",
    level: "healthy",
    detail: "OAuth client and bot verified",
    metrics: { botConfigured: true, guildConfigured: true },
  };
}

async function probeVirusTotal(): Promise<HealthServiceStatus> {
  const settings = await getMalwareScannerSettingsRaw();
  const quota = await getVirusTotalQuota();
  const apiKey = settings.virusTotalApiKey?.trim() || process.env.VIRUSTOTAL_API_KEY?.trim() || "";
  const enabled = settings.enabled && Boolean(apiKey);

  if (!enabled) {
    return {
      id: "virustotal",
      name: "VirusTotal",
      level: process.env.VIRUSTOTAL_ENABLED === "false" ? "warning" : "critical",
      detail:
        process.env.VIRUSTOTAL_ENABLED === "false"
          ? "Malware scanning disabled via VIRUSTOTAL_ENABLED=false"
          : "API key not configured",
      metrics: {
        requestsRemaining: quota.requestsRemaining,
        uploadsRemaining: quota.uploadsRemaining,
      },
    };
  }

  const requestUsage = quota.requestsUsed / quota.requestsLimit;
  const uploadUsage = quota.uploadsUsed / quota.uploadsLimit;

  if (quota.requestsRemaining <= 10 || quota.uploadsRemaining <= 5) {
    return {
      id: "virustotal",
      name: "VirusTotal",
      level: "critical",
      detail: `Daily quota nearly exhausted (${quota.requestsRemaining} requests left)`,
      metrics: {
        requestsRemaining: quota.requestsRemaining,
        uploadsRemaining: quota.uploadsRemaining,
      },
    };
  }

  if (requestUsage >= 0.8 || uploadUsage >= 0.8) {
    return {
      id: "virustotal",
      name: "VirusTotal",
      level: "warning",
      detail: `Quota at ${Math.round(Math.max(requestUsage, uploadUsage) * 100)}% for today`,
      metrics: {
        requestsRemaining: quota.requestsRemaining,
        uploadsRemaining: quota.uploadsRemaining,
      },
    };
  }

  return {
    id: "virustotal",
    name: "VirusTotal",
    level: "healthy",
    detail: `Scanner active · ${quota.requestsRemaining} requests remaining today`,
    metrics: {
      requestsRemaining: quota.requestsRemaining,
      uploadsRemaining: quota.uploadsRemaining,
    },
  };
}

async function probeR2(): Promise<HealthServiceStatus> {
  const config = getR2ConfigStatus();

  if (!config.configured) {
    return {
      id: "r2",
      name: "R2",
      level: "critical",
      detail: `Missing: ${config.missing.join(", ")}`,
      metrics: { publicUrl: config.publicUrl },
    };
  }

  const bucket = await probeR2Bucket();
  if (!bucket.ok) {
    return {
      id: "r2",
      name: "R2",
      level: "critical",
      detail: bucket.detail,
      metrics: { bucket: config.bucket, publicUrl: config.publicUrl },
    };
  }

  if (!config.publicUrl) {
    return {
      id: "r2",
      name: "R2",
      level: "warning",
      detail: "Bucket reachable · set R2_PUBLIC_URL for CDN delivery",
      metrics: { bucket: config.bucket, publicUrl: null },
    };
  }

  return {
    id: "r2",
    name: "R2",
    level: "healthy",
    detail: `${bucket.detail} · CDN ${config.publicUrl}`,
    metrics: { bucket: config.bucket, publicUrl: config.publicUrl },
  };
}

async function probePlatformMetrics(dbLatencyMs: number): Promise<{
  service: HealthServiceStatus;
  metrics: PlatformHealthMetrics;
}> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    activeUsers24h,
    uploadQueue,
    virusTotalQueue,
    failedUploads24h,
    failedPayments24h,
    failedReports24h,
    bytesAgg,
    mediaFiles,
  ] = await Promise.all([
    prisma.download
      .groupBy({
        by: ["userId"],
        where: { createdAt: { gte: since24h }, userId: { not: null } },
      })
      .then((rows) => rows.length)
      .catch(() => 0),
    prisma.storageUploadSession.count({ where: { status: "IN_PROGRESS" } }).catch(() => 0),
    prisma.scanQueue.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }).catch(() => 0),
    prisma.storageUploadSession.count({ where: { status: "ABORTED", createdAt: { gte: since24h } } }).catch(() => 0),
    prisma.customOrder.count({
      where: { status: { in: ["CANCELED", "REFUNDED"] }, updatedAt: { gte: since24h } },
    }).catch(() => 0),
    prisma.contentReport.count({
      where: { status: "REJECTED", updatedAt: { gte: since24h } },
    }).catch(() => 0),
    prisma.modVersion.aggregate({ _sum: { fileSize: true } }).catch(() => ({ _sum: { fileSize: null } })),
    prisma.mediaFile.count().catch(() => 0),
  ]);

  const trackedStorageMb =
    Number(bytesAgg._sum.fileSize ?? 0) > 0
      ? Math.round(Number(bytesAgg._sum.fileSize) / 1024 / 1024)
      : 0;

  const metrics: PlatformHealthMetrics = {
    activeUsers24h,
    uploadQueue,
    virusTotalQueue,
    failedUploads24h,
    failedPayments24h,
    failedReports24h,
    trackedStorageMb,
    mediaFiles,
    dbLatencyMs,
  };

  let level: HealthLevel = "healthy";
  let detail = `${activeUsers24h} active users · ${uploadQueue} uploads queued · ${virusTotalQueue} VT scans queued`;

  if (failedUploads24h >= 5 || failedPayments24h >= 3 || virusTotalQueue >= 50) {
    level = "critical";
    detail = `Failures detected — uploads: ${failedUploads24h}, payments: ${failedPayments24h}, VT queue: ${virusTotalQueue}`;
  } else if (uploadQueue >= 10 || virusTotalQueue >= 15 || failedUploads24h > 0) {
    level = "warning";
    detail = `Elevated queue load — uploads: ${uploadQueue}, VT: ${virusTotalQueue}`;
  }

  return {
    metrics,
    service: {
      id: "platform",
      name: "Platform",
      level,
      detail,
      metrics: {
        activeUsers24h,
        uploadQueue,
        virusTotalQueue,
        failedUploads24h,
        failedPayments24h,
        failedReports24h,
        trackedStorageMb,
        mediaFiles,
        dbLatencyMs,
      },
    },
  };
}

export async function runSystemHealthMonitor(): Promise<SystemHealthSnapshot> {
  const database = await probeDatabase();
  const platformProbe = await probePlatformMetrics(Number(database.metrics?.latencyMs ?? 0));

  const services = await Promise.all([
    Promise.resolve(database),
    probeApi(),
    probeUpload(),
    probeStorage(),
    probeEmail(),
    probeDiscordOAuth(),
    probeVirusTotal(),
    probeR2(),
    Promise.resolve(platformProbe.service),
  ]);

  const slowQueries = await listPerfSamples(15);

  return {
    overall: worstLevel(services.map((service) => service.level)),
    services,
    platform: platformProbe.metrics,
    slowQueries,
    checkedAt: new Date().toISOString(),
  };
}

import { getSiteSetting, setSiteSettingSafe } from "@/lib/site-settings";

type VtQuotaState = {
  date: string;
  requests: number;
  uploads: number;
};

const KEY = "vt_quota";
const DAILY_REQUEST_LIMIT = 500;
const DAILY_UPLOAD_LIMIT = 100;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getQuotaState(): Promise<VtQuotaState> {
  const stored = await getSiteSetting<VtQuotaState>(KEY, {
    date: todayKey(),
    requests: 0,
    uploads: 0,
  });
  if (stored.date !== todayKey()) {
    return { date: todayKey(), requests: 0, uploads: 0 };
  }
  return stored;
}

export async function getVirusTotalQuota() {
  const state = await getQuotaState();
  return {
    requestsUsed: state.requests,
    uploadsUsed: state.uploads,
    requestsLimit: DAILY_REQUEST_LIMIT,
    uploadsLimit: DAILY_UPLOAD_LIMIT,
    requestsRemaining: Math.max(0, DAILY_REQUEST_LIMIT - state.requests),
    uploadsRemaining: Math.max(0, DAILY_UPLOAD_LIMIT - state.uploads),
  };
}

export async function consumeVtRequest(isUpload = false): Promise<boolean> {
  const state = await getQuotaState();
  if (state.requests >= DAILY_REQUEST_LIMIT) return false;
  if (isUpload && state.uploads >= DAILY_UPLOAD_LIMIT) return false;
  await setSiteSettingSafe(KEY, {
    date: todayKey(),
    requests: state.requests + 1,
    uploads: isUpload ? state.uploads + 1 : state.uploads,
  });
  return true;
}

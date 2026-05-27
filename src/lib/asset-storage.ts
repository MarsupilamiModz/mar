import { buildAssetPublicUrl } from "@/lib/assets";
import { uploadToR2, deleteFromR2, getSignedDownloadUrl } from "@/lib/r2";
import { storageKey, STORAGE } from "@/lib/storage";
import {
  isSupabaseStorageConfigured,
  uploadToSupabaseStorage,
  deleteFromSupabaseStorage,
  type SupabaseBucket,
} from "@/lib/supabase-storage";

export type AssetBucket =
  | "mod-images"
  | "mod-thumbnails"
  | "creator-avatars"
  | "creator-banners"
  | "screenshots"
  | "temp-uploads"
  | "mods"
  | "avatars"
  | "games"
  | "tickets";

export type UploadAssetInput = {
  bucket: AssetBucket;
  relativePath: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
};

export type UploadAssetResult = {
  key: string;
  url: string;
  provider: "r2" | "supabase";
};

export function getStorageProvider(): "r2" | "supabase" {
  const configured = process.env.STORAGE_PROVIDER?.toLowerCase();
  if (configured === "r2") return "r2";
  if (configured === "supabase") return "supabase";
  if (isSupabaseStorageConfigured()) return "supabase";
  return "r2";
}

export function isStorageConfigured(): boolean {
  if (getStorageProvider() === "supabase") return isSupabaseStorageConfigured();
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim()
  );
}

function mapToSupabaseBucket(bucket: AssetBucket): SupabaseBucket {
  switch (bucket) {
    case "mod-images":
    case "mods":
    case "screenshots":
      return "mod-images";
    case "mod-thumbnails":
      return "mod-thumbnails";
    case "creator-avatars":
    case "avatars":
      return "creator-avatars";
    case "creator-banners":
      return "creator-banners";
    case "temp-uploads":
      return "temp-uploads";
    case "games":
      return "mod-images";
    case "tickets":
      return "temp-uploads";
    default:
      return "mod-images";
  }
}

function buildStorageKey(bucket: AssetBucket, relativePath: string): string {
  const clean = relativePath.replace(/^\/+/, "");
  if (bucket === "mods" || bucket === "games" || bucket === "avatars" || bucket === "tickets") {
    return storageKey(clean);
  }
  return storageKey(bucket, clean);
}

export async function uploadAsset(input: UploadAssetInput): Promise<UploadAssetResult> {
  if (!isStorageConfigured()) {
    throw new Error(
      "Storage is not configured. Set Supabase keys or Cloudflare R2 credentials in your environment."
    );
  }

  const provider = getStorageProvider();

  try {
    if (provider === "supabase") {
      const sbBucket = mapToSupabaseBucket(input.bucket);
      const result = await uploadToSupabaseStorage({
        bucket: sbBucket,
        relativePath: input.relativePath,
        body: input.body,
        contentType: input.contentType,
        cacheControl: input.cacheControl,
      });
      return { ...result, provider: "supabase" };
    }

    const key = buildStorageKey(input.bucket, input.relativePath);
    await uploadToR2(key, input.body, input.contentType, input.cacheControl);
    return {
      key,
      url: buildAssetPublicUrl(key),
      provider: "r2",
    };
  } catch (primaryError) {
    if (provider === "supabase" && isR2Configured()) {
      const key = buildStorageKey(input.bucket, input.relativePath);
      await uploadToR2(key, input.body, input.contentType, input.cacheControl);
      return {
        key,
        url: buildAssetPublicUrl(key),
        provider: "r2",
      };
    }
    throw primaryError instanceof Error ? primaryError : new Error("Upload failed");
  }
}

export async function deleteAsset(key: string, bucket?: AssetBucket) {
  if (key.includes("supabase.co/storage")) return;

  if (getStorageProvider() === "supabase" && bucket) {
    const parts = key.split("/");
    const relative = parts.slice(2).join("/");
    await deleteFromSupabaseStorage(mapToSupabaseBucket(bucket), relative);
    return;
  }

  const normalized = key.startsWith(STORAGE.prefix) ? key : storageKey(key);
  await deleteFromR2(normalized);
}

export async function getAssetSignedUrl(key: string, expiresIn = 300): Promise<string> {
  const normalized = key.startsWith(STORAGE.prefix) ? key : storageKey(key);
  return getSignedDownloadUrl(normalized, expiresIn);
}

function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim()
  );
}

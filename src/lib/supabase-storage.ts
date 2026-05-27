import { createServiceClient } from "@/lib/supabase/server";
import { buildAssetPublicUrl } from "@/lib/assets";
import { storageKey } from "@/lib/storage";

export const SUPABASE_BUCKETS = {
  modImages: "mod-images",
  modThumbnails: "mod-thumbnails",
  creatorAvatars: "creator-avatars",
  creatorBanners: "creator-banners",
  screenshots: "screenshots",
  tempUploads: "temp-uploads",
} as const;

export type SupabaseBucket = (typeof SUPABASE_BUCKETS)[keyof typeof SUPABASE_BUCKETS];

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export async function uploadToSupabaseStorage(options: {
  bucket: SupabaseBucket;
  relativePath: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<{ key: string; url: string }> {
  const supabase = await createServiceClient();
  const objectPath = options.relativePath.replace(/^\/+/, "");

  const { error } = await supabase.storage.from(options.bucket).upload(objectPath, options.body, {
    contentType: options.contentType,
    upsert: true,
    cacheControl: options.cacheControl ?? "public, max-age=31536000, immutable",
  });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(options.bucket).getPublicUrl(objectPath);
  const key = storageKey(options.bucket, objectPath);
  const url = data.publicUrl || buildAssetPublicUrl(key);
  return { key, url };
}

export async function deleteFromSupabaseStorage(bucket: SupabaseBucket, relativePath: string) {
  const supabase = await createServiceClient();
  const objectPath = relativePath.replace(/^\/+/, "");
  const { error } = await supabase.storage.from(bucket).remove([objectPath]);
  if (error) throw new Error(`Supabase delete failed: ${error.message}`);
}

export async function createSupabaseSignedUploadUrl(
  bucket: SupabaseBucket,
  relativePath: string,
  expiresIn = 300
) {
  const supabase = await createServiceClient();
  const objectPath = relativePath.replace(/^\/+/, "");
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(objectPath, {
    upsert: true,
  });
  if (error) throw new Error(`Signed upload URL failed: ${error.message}`);
  return { ...data, expiresIn };
}

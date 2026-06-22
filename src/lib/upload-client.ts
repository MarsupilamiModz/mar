"use client";

import {
  performMultipartUpload,
  type MultipartPurpose,
  type MultipartUploadProgress,
} from "@/lib/r2-multipart-client";
import { formatUploadErrorMessage } from "@/lib/upload-errors";
import { logUploadDiagnostic } from "@/lib/upload-limits";
import { dispatchProfileAvatarUpdated } from "@/lib/profile-media-events";
import { getMediaUrl } from "@/lib/media-url";

export type UploadPurpose =
  | "mod-screenshot"
  | "creator-avatar"
  | "creator-banner"
  | "user-avatar"
  | "partner-avatar"
  | "partner-banner"
  | "partner-logo"
  | "designer-avatar"
  | "designer-banner"
  | "game-asset"
  | "ticket-attachment"
  | "branding-asset"
  | "team-avatar"
  | "team-banner";

export type UploadApiResult = {
  url: string;
  key: string;
  mediaId?: string;
  provider?: string;
};

export type UploadProgressHandler = (progress: number) => void;

export type UploadApiOptions = {
  file: File;
  purpose: UploadPurpose;
  modId?: string;
  gameId?: string;
  assetType?: "icon" | "banner" | "cover";
  brandingAssetType?: string;
  teamMemberId?: string;
  onProgress?: UploadProgressHandler;
  signal?: AbortSignal;
};

function toMultipartPurpose(purpose: UploadPurpose): MultipartPurpose {
  return purpose;
}

function buildMetadata(options: UploadApiOptions): Record<string, string> | undefined {
  const meta: Record<string, string> = {};
  if (options.gameId) meta.gameId = options.gameId;
  if (options.assetType) meta.assetType = options.assetType;
  if (options.brandingAssetType) meta.assetType = options.brandingAssetType;
  if (options.teamMemberId) meta.teamMemberId = options.teamMemberId;
  return Object.keys(meta).length ? meta : undefined;
}

export async function uploadViaApi(options: UploadApiOptions): Promise<UploadApiResult> {
  const { file, purpose, modId, onProgress, signal } = options;

  logUploadDiagnostic("upload_via_api_start", {
    purpose,
    fileName: file.name,
    fileSize: file.size,
    modId,
    gameId: options.gameId,
  });

  const progressBridge = onProgress
    ? (state: MultipartUploadProgress) => onProgress(state.progress)
    : undefined;

  try {
    const result = await performMultipartUpload({
      file,
      purpose: toMultipartPurpose(purpose),
      modId,
      metadata: buildMetadata(options),
      signal,
      onProgress: progressBridge,
    });

    if (!result.url) {
      throw new Error("Upload failed: storage did not return a public URL");
    }

    logUploadDiagnostic("upload_via_api_ok", { purpose, url: result.url });

    if (
      purpose === "user-avatar" ||
      purpose === "creator-avatar" ||
      purpose === "partner-avatar" ||
      purpose === "designer-avatar"
    ) {
      dispatchProfileAvatarUpdated({
        avatarUrl: getMediaUrl(result.url),
      });
    }

    return {
      url: result.url,
      key: result.key,
      mediaId: result.mediaId,
      provider: "r2",
    };
  } catch (err) {
    const message = formatUploadErrorMessage(err);
    logUploadDiagnostic("upload_via_api_failed", { purpose, error: message });
    throw new Error(message);
  }
}

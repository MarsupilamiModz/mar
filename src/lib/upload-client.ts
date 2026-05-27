"use client";

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
  | "ticket-attachment";

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
  onProgress?: UploadProgressHandler;
  signal?: AbortSignal;
};

export function uploadViaApi(options: UploadApiOptions): Promise<UploadApiResult> {
  const { file, purpose, modId, gameId, assetType, onProgress, signal } = options;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append("file", file);
    fd.append("purpose", purpose);
    if (modId) fd.append("modId", modId);
    if (gameId) fd.append("gameId", gameId);
    if (assetType) fd.append("assetType", assetType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText) as UploadApiResult & { error?: string };
        if (xhr.status >= 200 && xhr.status < 300 && body.url) {
          resolve(body);
          return;
        }
        reject(new Error(body.error ?? `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));

    if (signal) {
      signal.addEventListener("abort", () => xhr.abort());
    }

    xhr.open("POST", "/api/upload");
    xhr.send(fd);
  });
}

"use client";

export const PROFILE_AVATAR_UPDATED = "xumari:profile-avatar-updated";

export type ProfileAvatarUpdatedDetail = {
  avatarUrl: string | null;
};

/** Notify layout/nav that the signed-in user's avatar changed. */
export function dispatchProfileAvatarUpdated(detail: ProfileAvatarUpdatedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROFILE_AVATAR_UPDATED, { detail }));
}

export function onProfileAvatarUpdated(
  handler: (detail: ProfileAvatarUpdatedDetail) => void
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const listener = (event: Event) => {
    const custom = event as CustomEvent<ProfileAvatarUpdatedDetail>;
    handler(custom.detail ?? { avatarUrl: null });
  };

  window.addEventListener(PROFILE_AVATAR_UPDATED, listener);
  return () => window.removeEventListener(PROFILE_AVATAR_UPDATED, listener);
}

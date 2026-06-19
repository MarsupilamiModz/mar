"use server";

import { searchMods, getPopularTags, logSearchQuery } from "@/lib/discovery";
import { ok, requireActionUser } from "@/lib/action-utils";

export async function searchModsAction(params: {
  query: string;
  gameSlug?: string;
  tag?: string;
  sort?: "downloads" | "trending" | "rating" | "newest" | "updated" | "likes";
  verifiedCreator?: boolean;
  page?: number;
}) {
  const { user } = await requireActionUser().then((r) => ({ user: r.user ?? undefined }));

  const result = await searchMods(params.query, {
    gameSlug: params.gameSlug,
    tag: params.tag,
    sort: params.sort,
    verifiedCreator: params.verifiedCreator,
    page: params.page,
  });

  void logSearchQuery({
    query: params.query || "(browse)",
    filters: params,
    userId: user?.id,
    resultCount: result.total,
  });

  return ok(result);
}

export async function getPopularTagsAction() {
  const tags = await getPopularTags(40);
  return ok({ tags });
}

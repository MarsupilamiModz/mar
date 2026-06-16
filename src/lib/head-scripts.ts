import { getSiteSetting, setSiteSetting } from "@/lib/site-settings";

export type HeadScriptSnippet = {
  id: string;
  label: string;
  html: string;
  enabled: boolean;
  placement: "head" | "body";
};

export type HeadMetaTag = {
  id: string;
  name?: string;
  property?: string;
  content: string;
};

export type HeadScriptsSettings = {
  metaTags: HeadMetaTag[];
  scriptSnippets: HeadScriptSnippet[];
};

export const DEFAULT_HEAD_SCRIPTS: HeadScriptsSettings = {
  metaTags: [],
  scriptSnippets: [],
};

const KEY = "head_scripts";

export async function getHeadScriptsSettings(): Promise<HeadScriptsSettings> {
  return getSiteSetting(KEY, DEFAULT_HEAD_SCRIPTS);
}

export async function saveHeadScriptsSettings(settings: HeadScriptsSettings) {
  await setSiteSetting(KEY, settings);
  const { revalidateTag } = await import("next/cache");
  revalidateTag("head-scripts");
}

/** Strip script tags — content only for next/script injection */
export function stripScriptTags(html: string): string {
  return html.replace(/<\/?script[^>]*>/gi, "").trim();
}

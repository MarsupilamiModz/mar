import { getSiteSetting, setSiteSetting } from "@/lib/site-settings";

export type PartnerFormFieldType =
  | "text"
  | "email"
  | "url"
  | "textarea"
  | "select"
  | "checkbox";

export type PartnerFormField = {
  id: string;
  type: PartnerFormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  sortOrder: number;
  options?: string[];
  mapsTo?: string;
};

const FORM_KEY = "partner_application_form";

export const DEFAULT_PARTNER_FORM_FIELDS: PartnerFormField[] = [
  { id: "creatorName", type: "text", label: "Name", placeholder: "Name / brand name", required: true, sortOrder: 0, mapsTo: "creatorName" },
  { id: "username", type: "text", label: "Username", placeholder: "Username", required: true, sortOrder: 1, mapsTo: "username" },
  { id: "email", type: "email", label: "Email", placeholder: "Email", required: true, sortOrder: 2, mapsTo: "email" },
  { id: "discord", type: "text", label: "Discord", placeholder: "Discord username", required: false, sortOrder: 3, mapsTo: "discord" },
  { id: "youtube", type: "url", label: "YouTube", placeholder: "YouTube URL", required: false, sortOrder: 4, mapsTo: "youtubeUrl" },
  { id: "twitch", type: "url", label: "Twitch", placeholder: "Twitch URL", required: false, sortOrder: 5, mapsTo: "twitchUrl" },
  { id: "tiktok", type: "url", label: "TikTok", placeholder: "TikTok URL", required: false, sortOrder: 6, mapsTo: "tiktokUrl" },
  { id: "instagram", type: "url", label: "Instagram", placeholder: "Instagram URL", required: false, sortOrder: 7, mapsTo: "instagramUrl" },
  { id: "x", type: "url", label: "X", placeholder: "X / Twitter URL", required: false, sortOrder: 8, mapsTo: "xUrl" },
  { id: "website", type: "url", label: "Website", placeholder: "Website URL", required: false, sortOrder: 9, mapsTo: "websiteUrl" },
  { id: "audienceSize", type: "text", label: "Audience Size", placeholder: "Audience size (e.g. 50k)", required: false, sortOrder: 10, mapsTo: "audienceSize" },
  { id: "country", type: "text", label: "Country", placeholder: "Country", required: false, sortOrder: 11, mapsTo: "country" },
  { id: "whyPartner", type: "textarea", label: "Why do you want to become a partner?", placeholder: "Tell us why you want to partner with us", required: true, sortOrder: 12, mapsTo: "whyPartner" },
  { id: "message", type: "textarea", label: "Additional notes", placeholder: "Anything else we should know?", required: false, sortOrder: 13, mapsTo: "message" },
];

export async function getPartnerFormFields(): Promise<PartnerFormField[]> {
  const stored = await getSiteSetting<{ fields?: PartnerFormField[] }>(FORM_KEY, {});
  const fields = stored.fields?.length ? stored.fields : DEFAULT_PARTNER_FORM_FIELDS;
  return [...fields].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function savePartnerFormFields(fields: PartnerFormField[]) {
  await setSiteSetting(FORM_KEY, { fields });
}

export function partnerFieldDefaults(username: string, email: string): Record<string, string> {
  return { username, email };
}

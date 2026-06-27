import { getSiteSetting, setSiteSettingSafe } from "@/lib/site-settings";

export type HostingPartnerSettings = {
  globalPartnerId: string | null;
  useGlobalPartner: boolean;
  allowCreatorLinks: boolean;
  creatorOnlyGlobal: boolean;
  revenueShareEnabled: boolean;
  creatorHostingShareBps: number;
  platformHostingShareBps: number;
  oneClickInstallEnabled: boolean;
};

export const DEFAULT_HOSTING_PARTNER_SETTINGS: HostingPartnerSettings = {
  globalPartnerId: null,
  useGlobalPartner: true,
  allowCreatorLinks: true,
  creatorOnlyGlobal: false,
  revenueShareEnabled: true,
  creatorHostingShareBps: 7000,
  platformHostingShareBps: 3000,
  oneClickInstallEnabled: false,
};

const KEY = "hosting_partner_settings";

export async function getHostingPartnerSettings(): Promise<HostingPartnerSettings> {
  const stored = await getSiteSetting<Partial<HostingPartnerSettings>>(KEY, {});
  return { ...DEFAULT_HOSTING_PARTNER_SETTINGS, ...stored };
}

export async function saveHostingPartnerSettings(
  settings: HostingPartnerSettings
): Promise<HostingPartnerSettings> {
  if (settings.revenueShareEnabled) {
    const total = settings.creatorHostingShareBps + settings.platformHostingShareBps;
    if (total !== 10000) {
      throw new Error("Hosting revenue shares must total 100% (10000 basis points).");
    }
  }
  const saved = await setSiteSettingSafe(KEY, settings);
  return saved.ok ? settings : DEFAULT_HOSTING_PARTNER_SETTINGS;
}

import { getAppUrl } from "@/lib/app-url";

export const SITE = {
  name: "MarsupilamiModz",
  shortName: "MarsupilamiModz",
  tagline: "Premium mods marketplace for serious gamers",
  description:
    "Discover, download, and support premium mods for GTA V, FiveM, Minecraft, ETS2, BeamNG, Assetto Corsa and more on MarsupilamiModz.",
  url: getAppUrl(),
  discord: "https://discord.gg/marsupilamimodz",
  twitter: "https://twitter.com/marsupilamimodz",
  themeColor: "#a855f7",
} as const;

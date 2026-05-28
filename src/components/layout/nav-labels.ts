import type { Locale } from "@/i18n/config";

export type NavLabels = {
  games: string;
  mods: string;
  creators: string;
  partners: string;
  shop: string;
  leaderboards: string;
  premium: string;
  customOrders: string;
  search: string;
};

export const NAV_LABEL_DEFAULTS: Record<Locale, NavLabels> = {
  de: {
    games: "Spiele",
    mods: "Mods",
    creators: "Creator",
    partners: "Partner",
    shop: "Shop",
    leaderboards: "Bestenliste",
    premium: "Premium",
    customOrders: "Aufträge",
    search: "Mods suchen",
  },
  en: {
    games: "Games",
    mods: "Mods",
    creators: "Creators",
    partners: "Partners",
    shop: "Shop",
    leaderboards: "Leaderboards",
    premium: "Premium",
    customOrders: "Commissions",
    search: "Search mods",
  },
  fr: {
    games: "Jeux",
    mods: "Mods",
    creators: "Créateurs",
    partners: "Partenaires",
    shop: "Boutique",
    leaderboards: "Classements",
    premium: "Premium",
    customOrders: "Commandes",
    search: "Rechercher des mods",
  },
  es: {
    games: "Juegos",
    mods: "Mods",
    creators: "Creadores",
    partners: "Socios",
    shop: "Tienda",
    leaderboards: "Clasificaciones",
    premium: "Premium",
    customOrders: "Encargos",
    search: "Buscar mods",
  },
  tr: {
    games: "Oyunlar",
    mods: "Modlar",
    creators: "İçerik üreticileri",
    partners: "Partnerler",
    shop: "Mağaza",
    leaderboards: "Sıralamalar",
    premium: "Premium",
    customOrders: "Siparişler",
    search: "Mod ara",
  },
  pl: {
    games: "Gry",
    mods: "Mody",
    creators: "Twórcy",
    partners: "Partnerzy",
    shop: "Sklep",
    leaderboards: "Rankingi",
    premium: "Premium",
    customOrders: "Zlecenia",
    search: "Szukaj modów",
  },
};

export function resolveNavLabel(value: string, fallback: string) {
  return value.startsWith("nav.") ? fallback : value;
}

import type { Locale } from "@/i18n/config";

export type NavLabels = {
  games: string;
  mods: string;
  collections: string;
  creators: string;
  partners: string;
  shop: string;
  leaderboards: string;
  premium: string;
  customOrders: string;
  developers: string;
  search: string;
};

export const NAV_LABEL_DEFAULTS: Record<Locale, NavLabels> = {
  de: {
    games: "Spiele",
    mods: "Mods",
    collections: "Sammlungen",
    creators: "Creator",
    partners: "Partner",
    shop: "Shop",
    leaderboards: "Bestenliste",
    premium: "Premium",
    customOrders: "Aufträge",
    developers: "Entwickler",
    search: "Mods suchen",
  },
  en: {
    games: "Games",
    mods: "Mods",
    collections: "Collections",
    creators: "Creators",
    partners: "Partners",
    shop: "Shop",
    leaderboards: "Leaderboards",
    premium: "Premium",
    customOrders: "Commissions",
    developers: "Developers",
    search: "Search mods",
  },
  fr: {
    games: "Jeux",
    mods: "Mods",
    collections: "Collections",
    creators: "Créateurs",
    partners: "Partenaires",
    shop: "Boutique",
    leaderboards: "Classements",
    premium: "Premium",
    customOrders: "Commandes",
    developers: "Développeurs",
    search: "Rechercher des mods",
  },
  es: {
    games: "Juegos",
    mods: "Mods",
    collections: "Colecciones",
    creators: "Creadores",
    partners: "Socios",
    shop: "Tienda",
    leaderboards: "Clasificaciones",
    premium: "Premium",
    customOrders: "Encargos",
    developers: "Desarrolladores",
    search: "Buscar mods",
  },
  tr: {
    games: "Oyunlar",
    mods: "Modlar",
    collections: "Koleksiyonlar",
    creators: "İçerik üreticileri",
    partners: "Partnerler",
    shop: "Mağaza",
    leaderboards: "Sıralamalar",
    premium: "Premium",
    customOrders: "Siparişler",
    developers: "Geliştiriciler",
    search: "Mod ara",
  },
  pl: {
    games: "Gry",
    mods: "Mody",
    collections: "Kolekcje",
    creators: "Twórcy",
    partners: "Partnerzy",
    shop: "Sklep",
    leaderboards: "Rankingi",
    premium: "Premium",
    customOrders: "Zlecenia",
    developers: "Deweloperzy",
    search: "Szukaj modów",
  },
};

export function resolveNavLabel(value: string, fallback: string) {
  return value.startsWith("nav.") ? fallback : value;
}

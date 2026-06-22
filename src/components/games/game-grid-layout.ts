/** /games page — portrait covers, 2 / 3 / 5 columns */
export const GAMES_PAGE_GRID_CLASS =
  "grid grid-cols-2 justify-items-center gap-4 sm:gap-5 md:grid-cols-3 lg:gap-6 xl:grid-cols-5";

/** Homepage featured games — portrait covers, slightly wider cards */
export const HOME_GAMES_GRID_CLASS =
  "grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:gap-6 xl:grid-cols-4";

/** @deprecated Use GAMES_PAGE_GRID_CLASS or HOME_GAMES_GRID_CLASS */
export const GAME_DISCOVERY_GRID_CLASS = HOME_GAMES_GRID_CLASS;

import { startDiscordImportBot } from "../src/lib/discord-import/bot";

startDiscordImportBot().catch((err) => {
  console.error("[discord-import-bot] fatal", err);
  process.exit(1);
});

import { drainImportQueue } from "../src/lib/discord-import/queue";

async function loop() {
  await drainImportQueue(10);
}

void loop();
setInterval(() => {
  void loop().catch((err) => console.error("[discord-import-worker]", err));
}, 5000);

console.log("[discord-import-worker] Queue worker started");

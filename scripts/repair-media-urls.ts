#!/usr/bin/env npx tsx
/**
 * Rebuild public URLs for mods, screenshots, avatars, and sound covers.
 * Run: npx tsx scripts/repair-media-urls.ts
 */
import { PrismaClient } from "@prisma/client";
import { runFullMediaRepair } from "../src/lib/media-repair";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting media URL repair…");
  const result = await runFullMediaRepair();
  console.log(JSON.stringify(result, null, 2));
  console.log(
    `Done — scanned ${result.totalScanned}, repaired ${result.totalRepaired}, missing ${result.totalMissing}`
  );
  if (result.errors.length) {
    console.error("Errors:", result.errors);
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

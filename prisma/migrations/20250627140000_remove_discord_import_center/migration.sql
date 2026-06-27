-- Remove Discord Import Center tables and settings

DROP TABLE IF EXISTS "DiscordImportJob";
DROP TABLE IF EXISTS "DiscordImportFile";
DROP TABLE IF EXISTS "DiscordImportEntry";
DROP TABLE IF EXISTS "DiscordImportChannel";
DROP TABLE IF EXISTS "DiscordImportRule";
DROP TABLE IF EXISTS "DiscordImportGuild";

DROP TYPE IF EXISTS "DiscordImportJobStatus";
DROP TYPE IF EXISTS "DiscordImportScanStatus";
DROP TYPE IF EXISTS "DiscordImportStatus";
DROP TYPE IF EXISTS "DiscordImportType";

DELETE FROM "SiteSetting" WHERE "key" = 'discord_import_settings';

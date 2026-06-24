-- Extended global language catalog (flags + native names for admin UI)
INSERT INTO "PlatformLanguage" ("id", "code", "name", "flagIcon", "isActive", "sortOrder", "updatedAt")
VALUES
  ('lang_pt', 'pt', 'Português', '🇵🇹', false, 8, CURRENT_TIMESTAMP),
  ('lang_ru', 'ru', 'Русский', '🇷🇺', false, 9, CURRENT_TIMESTAMP),
  ('lang_uk', 'uk', 'Українська', '🇺🇦', false, 10, CURRENT_TIMESTAMP),
  ('lang_ar', 'ar', 'العربية', '🇸🇦', false, 11, CURRENT_TIMESTAMP),
  ('lang_zh', 'zh', '中文', '🇨🇳', false, 12, CURRENT_TIMESTAMP),
  ('lang_ja', 'ja', '日本語', '🇯🇵', false, 13, CURRENT_TIMESTAMP),
  ('lang_ko', 'ko', '한국어', '🇰🇷', false, 14, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "flagIcon" = EXCLUDED."flagIcon",
  "updatedAt" = CURRENT_TIMESTAMP;

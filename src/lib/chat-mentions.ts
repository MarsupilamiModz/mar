export function parseMentionUsernames(content: string): string[] {
  const matches = content.match(/@([a-zA-Z0-9_]{2,32})/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
}

export function highlightMentions(content: string): string {
  return content.replace(
    /@([a-zA-Z0-9_]{2,32})/g,
    '<span class="text-neon-purple font-medium">@$1</span>'
  );
}

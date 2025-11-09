export type EmojiStyle = "apple" | "google" | "twitter" | "facebook";

// Centralized config; replace with your own CDN or local path later
export const EMOJI_CDN_BASE =
  "https://cdn.jsdelivr.net/npm/emoji-datasource-apple";

export function getEmojiUrl(
  unified: string,
  style: EmojiStyle = "apple",
  size: 64,
): string {
  // Apple datasource path format: /img/{style}/{size}/{unified}.png
  return `${EMOJI_CDN_BASE}/img/${style}/${size}/${unified}.png`;
}

export function unifiedToUnicode(unified: string): string {
  return unified
    .split("-")
    .map((u) => String.fromCodePoint(parseInt(u, 16)))
    .join("");
}

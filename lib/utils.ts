/** Maximum allowed content size in bytes (10MB) */
export const MAX_CONTENT_SIZE = 10 * 1024 * 1024;

/**
 * Returns the byte size of a string encoded as UTF-8.
 */
export function getContentByteSize(content: string): number {
  return new TextEncoder().encode(content).byteLength;
}

/**
 * Extracts a title from markdown content.
 *
 * The title is determined by the following rules:
 * 1. If the content is empty or whitespace only, returns 'Untitled'
 * 2. If the first line is an escaped heading (e.g., '\# hello'), removes the backslash and returns the text
 * 3. If the first line is a markdown heading (e.g., '# Title'), removes the '#' markers and returns the text
 * 4. Otherwise, returns the first line as-is
 *
 * @param content - The markdown content to extract the title from
 * @returns The extracted title, or 'Untitled' if no valid title is found
 */
export function extractTitle(content: string): string {
  if (!content || content.trim() === '') {
    return 'Untitled';
  }

  const firstLine = content.split('\n')[0].trim();

  if (!firstLine) {
    return 'Untitled';
  }

  // Check if the first line is an ACTUAL heading (not escaped)
  // Escaped headings like "\# hello" should be treated as plain text "# hello"
  if (firstLine.startsWith('\\#')) {
    // This is escaped - it's plain text, so remove the backslash escape
    return firstLine.replace(/^\\/, '').trim() || 'Untitled';
  }

  // If the first line is a real heading (starts with # but not \#), remove the # markers
  if (firstLine.startsWith('#')) {
    return firstLine.replace(/^#+\s*/, '').trim() || 'Untitled';
  }

  return firstLine;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(
  timestamp: number,
  now: number = Date.now(),
): string {
  const diff = now - timestamp;

  if (diff < MINUTE) {
    return 'たった今';
  }
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return `${minutes}分前`;
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours}時間前`;
  }

  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

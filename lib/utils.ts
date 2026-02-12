export { extractTitleFromProsemirrorJSON } from '../server/extract-title';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(
  timestamp: number,
  now: number = Date.now(),
): string {
  const diff = now - timestamp;

  // Negative diff can occur from server/client clock skew; treat as "just now"
  if (diff < 0) {
    return 'たった今';
  }

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
  const nowDate = new Date(now);
  if (date.getFullYear() !== nowDate.getFullYear()) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

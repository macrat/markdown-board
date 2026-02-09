/**
 * Extract a title from a ProseMirror JSON document structure.
 *
 * Looks at the first node in the document. If it is a heading,
 * concatenates all text nodes within it. Otherwise returns 'Untitled'.
 *
 * NOTE: server/websocket.js has a CJS copy of this function.
 * Keep both implementations in sync when modifying the logic.
 *
 * @param json - ProseMirror JSON (e.g. from yDocToProsemirrorJSON)
 * @returns The extracted title, or 'Untitled'
 */
export function extractTitleFromProsemirrorJSON(
  json: Record<string, unknown>,
): string {
  const content = json?.content as Array<Record<string, unknown>> | undefined;
  if (!content || content.length === 0) return 'Untitled';

  const firstNode = content[0];
  if (firstNode.type !== 'heading') return 'Untitled';

  const nodeContent = firstNode.content as
    | Array<Record<string, unknown>>
    | undefined;
  if (!nodeContent || nodeContent.length === 0) return 'Untitled';

  const text = collectText(nodeContent);
  return text.trim() || 'Untitled';
}

function collectText(nodes: Array<Record<string, unknown>>): string {
  let result = '';
  for (const node of nodes) {
    if (node.type === 'text' && typeof node.text === 'string') {
      result += node.text;
    }
    const children = node.content as Array<Record<string, unknown>> | undefined;
    if (children) {
      result += collectText(children);
    }
  }
  return result;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(
  timestamp: number,
  now: number = Date.now(),
): string {
  const diff = now - timestamp;

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

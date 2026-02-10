/**
 * Extract a title from a ProseMirror JSON document structure.
 *
 * Concatenates all text nodes within the first node of the document.
 * Returns 'Untitled' if no text is found.
 *
 * This is the canonical implementation shared by both the Next.js app
 * (via lib/utils.ts re-export) and the WebSocket server.
 *
 * @param {Record<string, unknown>} json - ProseMirror JSON (e.g. from yDocToProsemirrorJSON)
 * @returns {string} The extracted title, or 'Untitled'
 */
function extractTitleFromProsemirrorJSON(json) {
  const content = json?.content;
  if (!content || content.length === 0) return 'Untitled';

  const firstNode = content[0];

  const nodeContent = firstNode.content;
  if (!nodeContent || nodeContent.length === 0) return 'Untitled';

  const text = collectText(nodeContent);
  return text.trim() || 'Untitled';
}

function collectText(nodes) {
  let result = '';
  for (const node of nodes) {
    if (node.type === 'text' && typeof node.text === 'string') {
      result += node.text;
    }
    if (node.content) {
      result += collectText(node.content);
    }
  }
  return result;
}

module.exports = { extractTitleFromProsemirrorJSON };

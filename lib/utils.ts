/**
 * Extract a title from a ProseMirror JSON document structure.
 *
 * Looks at the first node in the document. If it is a heading,
 * concatenates all text nodes within it. Otherwise returns 'Untitled'.
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

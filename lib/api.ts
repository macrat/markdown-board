import type { PageListItem, ArchiveListItem } from './types';
import { logger } from './logger';

/**
 * Read and log the response body when an API response indicates an error.
 * Returns the error body text for optional further use.
 */
export async function logResponseError(
  context: string,
  response: Response,
): Promise<string> {
  let body = '';
  try {
    body = await response.text();
  } catch {
    // Body may not be readable
  }
  logger.error(
    `[${context}] Request failed: ${response.status} ${response.statusText}`,
    body,
  );
  return body;
}

// ---------------------------------------------------------------------------
// Runtime type guards for API responses
// ---------------------------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasPageListItemShape(item: unknown): item is PageListItem {
  if (!isObject(item)) return false;
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.created_at === 'number' &&
    typeof item.updated_at === 'number'
  );
}

export function isPageListItemArray(data: unknown): data is PageListItem[] {
  return Array.isArray(data) && data.every(hasPageListItemShape);
}

function hasArchiveListItemShape(item: unknown): item is ArchiveListItem {
  if (!isObject(item)) return false;
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.created_at === 'number' &&
    typeof item.updated_at === 'number' &&
    typeof item.archived_at === 'number'
  );
}

export function isArchiveListItemArray(
  data: unknown,
): data is ArchiveListItem[] {
  return Array.isArray(data) && data.every(hasArchiveListItemShape);
}

export function isCreatePageResponse(data: unknown): data is { id: string } {
  return isObject(data) && typeof data.id === 'string';
}

export function isArchivePageResponse(
  data: unknown,
): data is { archived_at: number } {
  return isObject(data) && typeof data.archived_at === 'number';
}

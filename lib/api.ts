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

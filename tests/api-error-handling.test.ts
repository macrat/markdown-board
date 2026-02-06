import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logResponseError } from '@/lib/api';
import { logger } from '@/lib/logger';

vi.mock('@/lib/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function createMockResponse(
  status: number,
  statusText: string,
  body: string,
): Response {
  return {
    status,
    statusText,
    ok: status >= 200 && status < 300,
    text: () => Promise.resolve(body),
  } as Response;
}

describe('logResponseError', () => {
  it('logs status, statusText, and response body', async () => {
    const response = createMockResponse(
      404,
      'Not Found',
      '{"error":"Page not found"}',
    );

    const body = await logResponseError('TestContext', response);

    expect(logger.error).toHaveBeenCalledWith(
      '[TestContext] Request failed: 404 Not Found',
      '{"error":"Page not found"}',
    );
    expect(body).toBe('{"error":"Page not found"}');
  });

  it('logs 500 server error with body', async () => {
    const response = createMockResponse(
      500,
      'Internal Server Error',
      'Something went wrong',
    );

    const body = await logResponseError('ServerCheck', response);

    expect(logger.error).toHaveBeenCalledWith(
      '[ServerCheck] Request failed: 500 Internal Server Error',
      'Something went wrong',
    );
    expect(body).toBe('Something went wrong');
  });

  it('handles empty response body', async () => {
    const response = createMockResponse(400, 'Bad Request', '');

    const body = await logResponseError('EmptyBody', response);

    expect(logger.error).toHaveBeenCalledWith(
      '[EmptyBody] Request failed: 400 Bad Request',
      '',
    );
    expect(body).toBe('');
  });

  it('handles unreadable response body gracefully', async () => {
    const response = {
      status: 502,
      statusText: 'Bad Gateway',
      ok: false,
      text: () => Promise.reject(new Error('Body already consumed')),
    } as Response;

    const body = await logResponseError('UnreadableBody', response);

    expect(logger.error).toHaveBeenCalledWith(
      '[UnreadableBody] Request failed: 502 Bad Gateway',
      '',
    );
    expect(body).toBe('');
  });

  it('returns body text for further use', async () => {
    const response = createMockResponse(
      422,
      'Unprocessable Entity',
      '{"field":"content","message":"required"}',
    );

    const body = await logResponseError('Validation', response);

    expect(body).toBe('{"field":"content","message":"required"}');
  });

  it('includes context label in log message', async () => {
    const response = createMockResponse(403, 'Forbidden', 'Access denied');

    await logResponseError('Editor Save', response);

    expect(logger.error).toHaveBeenCalledWith(
      '[Editor Save] Request failed: 403 Forbidden',
      'Access denied',
    );
  });
});

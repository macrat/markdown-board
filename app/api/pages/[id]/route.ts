import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { extractTitle } from '@/lib/utils';
import { logger } from '@/lib/logger';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const stmt = db.prepare(`
      SELECT id, title, content, created_at, updated_at, archived_at
      FROM pages
      WHERE id = ?
    `);

    const page = stmt.get(id);

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    return NextResponse.json(page);
  } catch (error) {
    logger.error('Failed to fetch page:', error);
    return NextResponse.json(
      { error: 'Failed to fetch page' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Parse JSON body with error handling
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate body is an object
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Request body must be an object' },
        { status: 400 },
      );
    }

    // Validate only expected fields are present
    const allowedFields = new Set(['content']);
    const bodyKeys = Object.keys(body);
    const unexpectedFields = bodyKeys.filter((key) => !allowedFields.has(key));

    if (unexpectedFields.length > 0) {
      return NextResponse.json(
        {
          error: `Unexpected field(s): ${unexpectedFields.join(', ')}. Only 'content' is allowed.`,
        },
        { status: 400 },
      );
    }

    const { content } = body as { content?: unknown };

    // Validate content is required
    if (content === undefined) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 },
      );
    }

    // Validate content is a string
    if (typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content must be a string' },
        { status: 400 },
      );
    }

    // Extract title from content
    const title = extractTitle(content);

    const now = Date.now();

    const stmt = db.prepare(`
      UPDATE pages
      SET title = ?, content = ?, updated_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(title, content, now, id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to update page:', error);
    return NextResponse.json(
      { error: 'Failed to update page' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const stmt = db.prepare(`
      DELETE FROM pages
      WHERE id = ?
    `);

    const result = stmt.run(id);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete page:', error);
    return NextResponse.json(
      { error: 'Failed to delete page' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const stmt = db.prepare(`
      SELECT id, title, created_at, updated_at, archived_at
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM yjs_updates WHERE doc_name = ?').run(id);
      return db.prepare('DELETE FROM pages WHERE id = ?').run(id);
    });

    const result = deleteTransaction();

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

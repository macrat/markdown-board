import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const stmt = db.prepare(`
      SELECT id, title, created_at, updated_at, archived_at
      FROM pages
      WHERE archived_at IS NOT NULL
      ORDER BY archived_at DESC
    `);

    const pages = stmt.all();
    return NextResponse.json(pages);
  } catch (error) {
    logger.error('Failed to fetch archived pages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch archived pages' },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    // Delete archived pages older than 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const stmt = db.prepare(`
      DELETE FROM pages
      WHERE archived_at IS NOT NULL AND archived_at < ?
    `);

    const result = stmt.run(thirtyDaysAgo);

    return NextResponse.json({ success: true, deleted: result.changes });
  } catch (error) {
    logger.error('Failed to clean up old archives:', error);
    return NextResponse.json(
      { error: 'Failed to clean up old archives' },
      { status: 500 },
    );
  }
}

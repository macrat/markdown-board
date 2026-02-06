import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';

const { cleanupOldArchives } = require('@/server/cleanup-archives'); // eslint-disable-line @typescript-eslint/no-require-imports

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
    const deleted = cleanupOldArchives(db);

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    logger.error('Failed to clean up old archives:', error);
    return NextResponse.json(
      { error: 'Failed to clean up old archives' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { generateId } from '@/lib/id';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT id, title, created_at, updated_at
      FROM pages
      WHERE archived_at IS NULL
      ORDER BY updated_at DESC
    `);

    const pages = stmt.all();
    return NextResponse.json(pages);
  } catch (error) {
    logger.error('Failed to fetch pages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pages' },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const db = getDb();
    const id = generateId();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO pages (id, title, created_at, updated_at, archived_at)
      VALUES (?, ?, ?, ?, NULL)
    `);

    stmt.run(id, 'Untitled', now, now);

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create page:', error);
    return NextResponse.json(
      { error: 'Failed to create page' },
      { status: 500 },
    );
  }
}

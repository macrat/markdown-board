import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const now = Date.now();
    
    const stmt = db.prepare(`
      UPDATE pages
      SET archived_at = ?
      WHERE id = ? AND archived_at IS NULL
    `);
    
    const result = stmt.run(now, id);
    
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Page not found or already archived' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, archived_at: now });
  } catch (error) {
    logger.error('Failed to archive page:', error);
    return NextResponse.json({ error: 'Failed to archive page' }, { status: 500 });
  }
}

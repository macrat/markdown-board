import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const stmt = db.prepare(`
      UPDATE pages
      SET archived_at = NULL
      WHERE id = ? AND archived_at IS NOT NULL
    `);
    
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Page not found or not archived' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to unarchive page:', error);
    return NextResponse.json({ error: 'Failed to unarchive page' }, { status: 500 });
  }
}

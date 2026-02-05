import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
    console.error('Failed to fetch page:', error);
    return NextResponse.json({ error: 'Failed to fetch page' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, content } = body;
    
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
    console.error('Failed to update page:', error);
    return NextResponse.json({ error: 'Failed to update page' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
    console.error('Failed to delete page:', error);
    return NextResponse.json({ error: 'Failed to delete page' }, { status: 500 });
  }
}

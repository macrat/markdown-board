import { redirect } from 'next/navigation';
import getDb from '@/lib/db';
import { generateId } from '@/lib/id';

export const dynamic = 'force-dynamic';

export default function Home() {
  const db = getDb();
  const id = generateId();
  const now = Date.now();

  try {
    db.prepare(
      `INSERT INTO pages (id, title, created_at, updated_at, archived_at) VALUES (?, ?, ?, ?, NULL)`,
    ).run(id, 'Untitled', now, now);
  } catch {
    throw new Error('Failed to create a new page');
  }

  redirect(`/p/${id}`);
}

import { redirect } from 'next/navigation';
import getDb from '@/lib/db';
import { generateId } from '@/lib/id';

export const dynamic = 'force-dynamic';

export default function Home() {
  const db = getDb();
  const id = generateId();
  const now = Date.now();

  db.prepare(
    `INSERT INTO pages (id, title, created_at, updated_at, archived_at) VALUES (?, ?, ?, ?, NULL)`,
  ).run(id, 'Untitled', now, now);

  redirect(`/p/${id}`);
}

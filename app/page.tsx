import { redirect } from 'next/navigation';
import { uuidv7 } from 'uuidv7';
import getDb from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function Home() {
  const db = getDb();
  const id = uuidv7();
  const now = Date.now();

  db.prepare(
    `INSERT INTO pages (id, title, created_at, updated_at, archived_at) VALUES (?, ?, ?, ?, NULL)`,
  ).run(id, 'Untitled', now, now);

  redirect(`/page/${id}`);
}

import fs from 'fs';
import path from 'path';

export default function globalTeardown() {
  const dbPath = process.env.DATABASE_PATH;
  if (!dbPath) return;

  const dbDir = path.dirname(dbPath);
  if (fs.existsSync(dbDir)) {
    fs.rmSync(dbDir, { recursive: true });
  }
}

import fs from 'fs';
import path from 'path';
import os from 'os';

export default function globalSetup() {
  const testDbDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'markdown-board-e2e-'),
  );
  process.env.DATABASE_PATH = path.join(testDbDir, 'markdown-board.db');
  process.env.PORT = '3100';
  process.env.NEXT_PUBLIC_WS_PORT = '1334';
}

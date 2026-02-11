import fs from 'fs';
import path from 'path';
import os from 'os';

export const TEST_DB_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), 'markdown-board-e2e-'),
);
export const TEST_DB_PATH = path.join(TEST_DB_DIR, 'markdown-board.db');

export default function globalSetup() {
  // Directory already created by mkdtempSync at module load time
}

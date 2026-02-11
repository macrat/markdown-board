import fs from 'fs';
import path from 'path';
import os from 'os';

export const TEST_DB_DIR = path.join(os.tmpdir(), 'markdown-board-e2e');
export const TEST_DB_PATH = path.join(TEST_DB_DIR, 'markdown-board.db');

export default function globalSetup() {
  if (fs.existsSync(TEST_DB_DIR)) {
    fs.rmSync(TEST_DB_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DB_DIR, { recursive: true });
}

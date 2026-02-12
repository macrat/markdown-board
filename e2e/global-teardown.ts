import fs from 'fs';
import { TEST_DB_DIR } from './global-setup';

export default function globalTeardown() {
  if (fs.existsSync(TEST_DB_DIR)) {
    fs.rmSync(TEST_DB_DIR, { recursive: true });
  }
}

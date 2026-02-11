import { randomBytes } from 'crypto';

const CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 12;
const MAX_BYTE = Math.floor(256 / CHARSET.length) * CHARSET.length;

export function generateId(): string {
  let id = '';
  while (id.length < ID_LENGTH) {
    const bytes = randomBytes(ID_LENGTH - id.length);
    for (let i = 0; i < bytes.length && id.length < ID_LENGTH; i++) {
      if (bytes[i] < MAX_BYTE) {
        id += CHARSET[bytes[i] % CHARSET.length];
      }
    }
  }
  return id;
}

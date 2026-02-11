import { randomBytes } from 'crypto';

const CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 12;

export function generateId(): string {
  const bytes = randomBytes(ID_LENGTH);
  let id = '';
  for (let i = 0; i < ID_LENGTH; i++) {
    id += CHARSET[bytes[i] % CHARSET.length];
  }
  return id;
}

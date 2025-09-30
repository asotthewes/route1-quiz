import { customAlphabet } from 'nanoid';
export const genCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

export function normalize(s) {
  return (s || '').toString().trim().toLowerCase();
}

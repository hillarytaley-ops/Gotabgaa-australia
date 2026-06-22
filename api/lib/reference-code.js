const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferenceCode() {
  let suffix = '';
  for (let i = 0; i < 8; i += 1) {
    suffix += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return `GA-${suffix}`;
}

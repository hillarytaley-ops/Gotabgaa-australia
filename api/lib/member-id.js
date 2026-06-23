const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateMembershipId() {
  let suffix = '';
  for (let i = 0; i < 8; i += 1) {
    suffix += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return `GAA-MEM-${suffix}`;
}

import { hashPassword } from '../hash';
import bcrypt from 'bcrypt';
import { describe, it, expect } from 'vitest';

describe('hashPassword', () => {
  it('should hash a password and match the original', async () => {
    const password = 'mySecret123!';
    const hash = await hashPassword(password);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
    const isMatch = await bcrypt.compare(password, hash);
    expect(isMatch).toBe(true);
  });
});

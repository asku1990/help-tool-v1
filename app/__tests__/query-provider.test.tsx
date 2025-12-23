import { describe, it, expect } from 'vitest';
import { createFallbackStorage } from '@/app/query-provider';

describe('createFallbackStorage', () => {
  it('returns null for getItem calls', () => {
    const storage = createFallbackStorage();
    expect(storage.getItem('missing')).toBeNull();
  });

  it('does not throw when setting items', () => {
    const storage = createFallbackStorage();
    expect(() => storage.setItem('key', 'value')).not.toThrow();
  });

  it('does not throw when removing items', () => {
    const storage = createFallbackStorage();
    expect(() => storage.removeItem('key')).not.toThrow();
  });
});

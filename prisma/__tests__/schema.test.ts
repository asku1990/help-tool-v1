import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Prisma schema.prisma file', () => {
  const schemaPath = path.join(__dirname, '../schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  it('should contain a datasource block', () => {
    expect(
      schema.includes('datasource db'),
      'Expected schema.prisma to contain a datasource block named "db".'
    ).toBeTruthy();
  });

  it('should contain a generator block', () => {
    expect(
      schema.includes('generator client'),
      'Expected schema.prisma to contain a generator block named "client".'
    ).toBeTruthy();
  });

  it('should contain models', () => {
    const expectedModels = ['User', 'Vehicle', 'FuelFillUp', 'Expense'];
    expectedModels.forEach(model => {
      expect(
        schema.includes(`model ${model} {`),
        `Expected schema.prisma to contain a "${model}" model definition.`
      ).toBeTruthy();
    });
  });
});

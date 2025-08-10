import { it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

it('should contain all required User fields with correct types and attributes', () => {
  const schemaPath = path.join(__dirname, '../../schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const userModelMatch = schema.match(/model User \{([\s\S]*?)\}/);

  expect(userModelMatch).not.toBeNull();

  const userModel = userModelMatch ? userModelMatch[1] : '';
  // Extract fields, types, and attributes from the model
  const fieldRegex = /^\s*(\w+)\s+(\w+)([^\n]*)/gm;
  type FieldInfo = { type: string; attributes: string[] };
  const fields: Record<string, FieldInfo> = {};
  let match;
  while ((match = fieldRegex.exec(userModel)) !== null) {
    const name = match[1];
    const type = match[2];
    // Split attributes by space, filter out empty strings, and trim
    const attributes = match[3]
      .split(' ')
      .map(attr => attr.trim())
      .filter(attr => attr.startsWith('@'));
    fields[name] = { type, attributes };
  }

  const expectedFields: Record<string, FieldInfo> = {
    id: { type: 'String', attributes: ['@id', '@default(uuid())'] },
    email: { type: 'String', attributes: ['@unique'] },
    username: { type: 'String', attributes: ['@unique'] },
    passwordHash: { type: 'String', attributes: [] },
    createdAt: { type: 'DateTime', attributes: ['@default(now())'] },
    updatedAt: { type: 'DateTime', attributes: ['@updatedAt'] },
    userType: { type: 'UserType', attributes: ['@default(REGULAR)'] },
    // Note: simple regex parser strips [] from list types
    vehicles: { type: 'Vehicle', attributes: [] },
  };

  expect(Object.keys(fields).sort()).toEqual(Object.keys(expectedFields).sort());
  for (const [field, { type, attributes }] of Object.entries(expectedFields)) {
    expect(fields[field].type).toBe(type);
    for (const expectedAttr of attributes) {
      expect(
        fields[field].attributes.includes(expectedAttr),
        `Expected field "${field}" to have attribute "${expectedAttr}". Actual attributes: ${JSON.stringify(fields[field].attributes)}`
      ).toBeTruthy();
    }
  }
});

it('should contain the UserType enum with correct values', () => {
  const schemaPath = path.join(__dirname, '../../schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const enumMatch = schema.match(/enum UserType \{([\s\S]*?)\}/);

  expect(enumMatch).not.toBeNull();

  const enumBody = enumMatch ? enumMatch[1] : '';
  const enumValues = enumBody
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  expect(enumValues.sort()).toEqual(['ADMIN', 'REGULAR', 'GUEST'].sort());
});

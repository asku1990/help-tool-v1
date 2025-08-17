import { faker } from '@faker-js/faker';
import { PrismaClient, ExpenseCategory } from '@/generated/prisma';

export function userFactory(overrides?: Partial<{ email: string; username: string }>) {
  return {
    email: overrides?.email ?? faker.internet.email(),
    username: overrides?.username ?? faker.internet.username(),
    passwordHash: '',
    userType: 'REGULAR' as const,
  };
}

export function vehicleFactory(userId: string, overrides?: Partial<{ name: string }>) {
  return {
    userId,
    name: overrides?.name ?? faker.vehicle.vehicle(),
  };
}

export function expenseFactory(vehicleId: string, overrides?: Partial<{ amount: number }>) {
  return {
    vehicleId,
    date: new Date(),
    category: 'MAINTENANCE' as ExpenseCategory,
    amount: overrides?.amount ?? Number(faker.finance.amount({ min: 5, max: 100, dec: 2 })),
  };
}

export async function seedOneVehicleWithExpense(prisma: PrismaClient) {
  const user = await prisma.user.create({ data: userFactory() });
  const vehicle = await prisma.vehicle.create({ data: vehicleFactory(user.id) });
  const expense = await prisma.expense.create({ data: expenseFactory(vehicle.id) });
  return { user, vehicle, expense };
}

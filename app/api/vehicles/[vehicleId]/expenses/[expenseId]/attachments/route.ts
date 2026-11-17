import { handleAttachments } from '@/lib/attachments/handler';

export const runtime = 'nodejs';

type Context = { params: Promise<{ vehicleId: string; expenseId: string }> };

export async function GET(req: Request, context: Context) {
  const { vehicleId, expenseId } = await context.params;
  return handleAttachments(req, vehicleId, { type: 'expense', id: expenseId });
}

export async function POST(req: Request, context: Context) {
  const { vehicleId, expenseId } = await context.params;
  return handleAttachments(req, vehicleId, { type: 'expense', id: expenseId });
}

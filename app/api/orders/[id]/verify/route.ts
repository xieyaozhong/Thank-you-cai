import { errorResponse, verifyOrder } from "../../../_lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const input: unknown = await request.json();
    const { id } = await context.params;
    await verifyOrder(request, id, input);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

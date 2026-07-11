import { dispatchOrder, errorResponse } from "../../../_lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await dispatchOrder(request, id);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

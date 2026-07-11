import { createOrder, errorResponse } from "../_lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input: unknown = await request.json();
    const order = await createOrder(request, input);
    return Response.json({ order }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

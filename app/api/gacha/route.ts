import { drawGacha, errorResponse } from "../_lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const card = await drawGacha(request);
    return Response.json({ card });
  } catch (error) {
    return errorResponse(error);
  }
}

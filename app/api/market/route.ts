import { errorResponse, getMarketState } from "../_lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.json(await getMarketState(request), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

import { errorResponse, publishMenu } from "../_lib/store";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const input: unknown = await request.json();
    return Response.json(await publishMenu(request, input));
  } catch (error) {
    return errorResponse(error);
  }
}

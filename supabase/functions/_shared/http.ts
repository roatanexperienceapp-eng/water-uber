// Small helpers shared by edge functions.
export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function fail(status: number, code: string, message: string): Response {
  return Response.json({ code, message }, { status });
}

export async function readBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

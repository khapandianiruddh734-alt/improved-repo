export const config = {
  runtime: "edge",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text : "";
    if (!text) {
      return json({ error: "Invalid body. Expected { text }" }, 400);
    }

    return json({ text: text.slice(0, 500) }, 200);
  } catch {
    return json({ error: "Internal server error" }, 500);
  }
}


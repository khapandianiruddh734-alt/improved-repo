export const config = {
  runtime: "edge",
};

type ToolName = "uppercase" | "count-characters" | "count characters";

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
    const tool = body?.tool as ToolName;
    const text = typeof body?.text === "string" ? body.text : "";

    if (!tool || !text) {
      return json({ error: "Invalid body. Expected { tool, text }" }, 400);
    }

    if (tool === "uppercase") {
      return json({ result: text.toUpperCase() }, 200);
    }

    if (tool === "count-characters" || tool === "count characters") {
      return json({ result: text.length }, 200);
    }

    return json({ error: "Unsupported tool" }, 400);
  } catch {
    return json({ error: "Internal server error" }, 500);
  }
}

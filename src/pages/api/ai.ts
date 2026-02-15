import { runAI } from "../../lib/aiClient";

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
    const prompt = typeof body?.prompt === "string" ? body.prompt : "";

    if (!prompt) {
      return json({ error: "Invalid body. Expected { prompt }" }, 400);
    }

    const text = await runAI(prompt);

    return json({ text, cached: false }, 200);
  } catch {
    return json({ error: "Internal server error" }, 500);
  }
}

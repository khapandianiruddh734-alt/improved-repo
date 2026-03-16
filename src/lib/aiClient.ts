const AI_API_KEY = process.env.AI_API_KEY;
const GEMINI_MODEL = (process.env.GEMINI_MODEL || "gemini-2.0-flash").trim();
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

export async function runAI(prompt: string): Promise<string> {
  if (!AI_API_KEY) {
    throw new Error("Missing AI_API_KEY");
  }

  const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(AI_API_KEY)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof text !== "string") {
    throw new Error("AI API returned empty text");
  }

  return text;
}

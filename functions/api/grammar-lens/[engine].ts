interface Env { GEMINI_API_KEY: string }

const MODEL = "gemini-3.6-flash";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const engine = context.params.engine as string;
  if (engine !== "ai" && engine !== "gramformer") {
    return Response.json({ error: "Unknown Grammar Lens engine." }, { status: 404 });
  }

  try {
    const body = await context.request.json() as { text?: string };
    const text = body.text?.trim();
    if (!text) return Response.json({ error: "No text provided." }, { status: 400 });
    if (!context.env.GEMINI_API_KEY) {
      return Response.json({ error: "GEMINI_API_KEY is not configured yet." }, { status: 503 });
    }

    const prompt = engine === "gramformer"
      ? `Act as a strict Gramformer-style grammar correction engine. Return ONLY actual grammar, spelling, punctuation and capitalization errors. Do not rewrite good prose and do not invent issues. For each issue return category, severity, exact originalText, one or more suggestions, shortTitle and a concise explanation. Text:\n\"\"\"\function () { [native code] }\"\"\"`
      : `Act as the AI engine of Grammar Lens. Analyze the text contextually for grammar, spelling, punctuation, capitalization and clear usage problems. Return ONLY actual issues, preserving the writer's meaning. For each issue return category, severity, exact originalText, one or more suggestions, shortTitle and a concise explanation. Text:\n\"\"\"\function () { [native code] }\"\"\"`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent?key=" + encodeURIComponent(context.env.GEMINI_API_KEY), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              mistakes: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    category: { type: "STRING" },
                    severity: { type: "STRING" },
                    originalText: { type: "STRING" },
                    suggestions: { type: "ARRAY", items: { type: "STRING" } },
                    shortTitle: { type: "STRING" },
                    explanation: { type: "STRING" }
                  },
                  required: ["category","severity","originalText","suggestions","shortTitle","explanation"]
                }
              }
            },
            required: ["mistakes"]
          }
        }
      })
    });

    const raw = await response.json() as any;
    if (!response.ok) {
      return Response.json({ error: raw?.error?.message || "Gemini request failed." }, { status: response.status });
    }

    const jsonText = raw?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) return Response.json({ error: "No analysis returned." }, { status: 502 });

    return Response.json(JSON.parse(jsonText));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Grammar Lens request failed." }, { status: 500 });
  }
};
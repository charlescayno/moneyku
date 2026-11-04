// =============================
// Gemini client (REST, called straight from the browser)
// =============================
export const GEMINI_MODEL = "gemini-3.8-flash";
const endpoint = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

export class GeminiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const nullable = (type, extra = {}) => ({ type, nullable: true, ...extra });

const SCHEMA = {
  type: "OBJECT",
  properties: {
    message: nullable("STRING"),
    actions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          op: { type: "STRING", enum: ["add_item", "edit_item", "mark_paid"] },
          id: nullable("STRING"),
          kind: nullable("STRING", { enum: ["income", "expenses"] }),
          who: nullable("STRING", { enum: ["charlie", "debt"] }),
          name: nullable("STRING"),
          amount: nullable("NUMBER"),
          month: nullable("STRING"),
          recurring: nullable("BOOLEAN"),
          dueDay: nullable("INTEGER"),
          scope: nullable("STRING", { enum: ["all", "future", "month"] }),
          paid: nullable("BOOLEAN"),
        },
        required: ["op"],
      },
    },
  },
  required: ["actions"],
};

const SYSTEM = `You turn short personal-budget messages (currency: Philippine peso) into structured actions for a budgeting app.
Actions:
- add_item: new income or expense. Needs kind ("income"|"expenses"), name, amount (number). Optional: month (YYYY-MM, default = selected month), recurring (true only if the user says monthly/every month/subscription/bill; otherwise false), dueDay, who ("charlie" default; "debt" only for money owed to/by other people).
- edit_item: change an EXISTING item. id MUST be copied from the provided items list. Optional name, amount, dueDay, scope ("month" = only the selected month, "future" = this and later months, "all" = everywhere; default "all").
- mark_paid: set an existing item's paid state for a month. id from the list; paid true unless the user says unpaid; optional month.
Rules: never invent ids. Never delete anything. Amounts are plain numbers (no symbols). Resolve relative dates using today's date. If the message is unclear or unsupported, return an empty actions array and a short "message" explaining why. Keep names short and Title Case.`;

export async function askGemini(text, context, apiKey, model = GEMINI_MODEL) {
  if (!apiKey) throw new GeminiError("no_key", "Add your Gemini API key first.");
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new GeminiError("offline", "You're offline. Quick log needs an internet connection.");
  }
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: JSON.stringify({ request: text, ...context }) }] }],
    generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema: SCHEMA },
  };

  let res;
  try {
    res = await fetch(endpoint(model), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });
  } catch {
    throw new GeminiError("network", "Couldn't reach Gemini. Check your connection and try again.");
  }

  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.error?.message || ""; } catch { /* ignore */ }
    if (res.status === 429) throw new GeminiError("rate", "Gemini rate limit reached. Wait a minute and try again.");
    if (res.status === 400 && /api key/i.test(detail)) throw new GeminiError("bad_key", "That API key isn't valid. Check it in the key settings.");
    if (res.status === 401 || res.status === 403) throw new GeminiError("bad_key", "Gemini rejected the API key. Check it in the key settings.");
    throw new GeminiError("http", `Gemini error (${res.status}). ${detail}`.trim());
  }

  let parsed;
  try {
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    parsed = JSON.parse(raw);
  } catch {
    throw new GeminiError("parse", "Couldn't understand Gemini's reply. Try rephrasing.");
  }
  if (!parsed || !Array.isArray(parsed.actions)) throw new GeminiError("parse", "Couldn't understand Gemini's reply. Try rephrasing.");
  return { actions: parsed.actions, message: parsed.message || "" };
}

interface AgentResult {
  agent: string;
  result: string;
  tokens: number;
  durationMs: number;
  status: 'success' | 'error';
}

const API_KEY = import.meta.env.GEMINI_API_KEY || import.meta.env.GOOGLE_AI_API_KEY;

export async function run(task: string, config: { model?: string; systemPrompt?: string; maxTokens?: number; temperature?: number }): Promise<AgentResult> {
  const start = Date.now();
  const model = config.model || 'gemini-2.0-flash';

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  if (config.systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: config.systemPrompt }] });
    contents.push({ role: 'model', parts: [{ text: 'Entendido.' }] });
  }
  contents.push({ role: 'user', parts: [{ text: task }] });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': API_KEY,
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        maxOutputTokens: config.maxTokens || 2048,
        temperature: config.temperature,
      },
    }),
  });

  const durationMs = Date.now() - start;

  if (!res.ok) {
    const err = await res.text();
    return { agent: 'gemini', result: `Error ${res.status}: ${err}`, tokens: 0, durationMs, status: 'error' };
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
  const tokens = (data.usageMetadata?.promptTokenCount || 0) + (data.usageMetadata?.candidatesTokenCount || 0);

  return { agent: 'gemini', result: text, tokens, durationMs, status: 'success' };
}

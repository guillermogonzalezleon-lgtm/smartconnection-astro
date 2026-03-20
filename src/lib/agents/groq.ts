interface AgentResult {
  agent: string;
  result: string;
  tokens: number;
  durationMs: number;
  status: 'success' | 'error';
}

const API_KEY = import.meta.env.GROQ_API_KEY;

export async function run(task: string, config: { model?: string; systemPrompt?: string; maxTokens?: number; temperature?: number }): Promise<AgentResult> {
  const start = Date.now();
  const model = config.model || 'llama-3.3-70b-versatile';

  const messages: Array<{ role: string; content: string }> = [];
  if (config.systemPrompt) messages.push({ role: 'system', content: config.systemPrompt });
  messages.push({ role: 'user', content: task });

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: config.maxTokens || 2048,
      temperature: config.temperature,
    }),
  });

  const durationMs = Date.now() - start;

  if (!res.ok) {
    const err = await res.text();
    return { agent: 'groq', result: `Error ${res.status}: ${err}`, tokens: 0, durationMs, status: 'error' };
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || 'Sin respuesta';
  const tokens = data.usage?.total_tokens || 0;

  return { agent: 'groq', result: text, tokens, durationMs, status: 'success' };
}

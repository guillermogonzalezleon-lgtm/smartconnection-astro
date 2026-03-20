interface AgentResult {
  agent: string;
  result: string;
  tokens: number;
  durationMs: number;
  status: 'success' | 'error';
}

const API_KEY = import.meta.env.ANTHROPIC_API_KEY;

export async function run(task: string, config: { model?: string; systemPrompt?: string; maxTokens?: number; temperature?: number }): Promise<AgentResult> {
  const start = Date.now();
  const model = config.model || 'claude-sonnet-4-20250514';

  const messages: Array<{ role: string; content: string }> = [
    { role: 'user', content: task },
  ];

  const body: Record<string, unknown> = {
    model,
    max_tokens: config.maxTokens || 2048,
    messages,
  };

  if (config.systemPrompt) body.system = config.systemPrompt;
  if (config.temperature !== undefined) body.temperature = config.temperature;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const durationMs = Date.now() - start;

  if (!res.ok) {
    const err = await res.text();
    return { agent: 'claude', result: `Error ${res.status}: ${err}`, tokens: 0, durationMs, status: 'error' };
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || 'Sin respuesta';
  const tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

  return { agent: 'claude', result: text, tokens, durationMs, status: 'success' };
}

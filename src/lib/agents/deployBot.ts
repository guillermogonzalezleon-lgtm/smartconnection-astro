interface AgentResult {
  agent: string;
  result: string;
  tokens: number;
  durationMs: number;
  status: 'success' | 'error';
}

const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN;
const GITHUB_REPO = import.meta.env.GITHUB_REPO || 'guillermogonzalezleon-lgtm/smartconnection-astro';
const WORKFLOW_ID = import.meta.env.GITHUB_WORKFLOW_ID || 'deploy.yml';

export async function run(task: string, _config: { model?: string; systemPrompt?: string; maxTokens?: number; temperature?: number }): Promise<AgentResult> {
  const start = Date.now();

  if (!GITHUB_TOKEN) {
    return { agent: 'deployer', result: 'GITHUB_TOKEN no configurado. Deploy se ejecuta automáticamente via push a main.', tokens: 0, durationMs: Date.now() - start, status: 'error' };
  }

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main' }),
  });

  const durationMs = Date.now() - start;

  if (!res.ok && res.status !== 204) {
    const err = await res.text();
    return { agent: 'deployer', result: `Error disparando workflow: ${res.status} ${err}`, tokens: 0, durationMs, status: 'error' };
  }

  return { agent: 'deployer', result: `Deploy disparado exitosamente. Task: ${task}`, tokens: 0, durationMs, status: 'success' };
}

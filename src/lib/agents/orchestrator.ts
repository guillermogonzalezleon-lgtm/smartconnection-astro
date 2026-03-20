import * as claude from './claude';
import * as groq from './groq';
import * as grok from './grok';
import * as gemini from './gemini';
import * as deployBot from './deployBot';
import { supabaseInsert, supabaseQuery } from '../supabase';

export interface AgentResult {
  agent: string;
  result: string;
  tokens: number;
  durationMs: number;
  status: 'success' | 'error';
}

interface AgentConfig {
  agent_id: string;
  name: string;
  model: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  enabled: boolean;
}

const AGENT_MODULES: Record<string, typeof claude> = {
  claude,
  groq,
  grok,
  gemini,
  deployer: deployBot,
};

const AGENT_TIMEOUT = 30_000;
const MAX_RETRIES = 2;

async function runWithRetry(
  agentId: string,
  task: string,
  config: { model?: string; systemPrompt?: string; maxTokens?: number; temperature?: number },
  retries = MAX_RETRIES
): Promise<AgentResult> {
  const mod = AGENT_MODULES[agentId];
  if (!mod) {
    return { agent: agentId, result: `Módulo ${agentId} no encontrado`, tokens: 0, durationMs: 0, status: 'error' };
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await Promise.race([
        mod.run(task, config),
        new Promise<AgentResult>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), AGENT_TIMEOUT)
        ),
      ]);
      if (result.status === 'success' || attempt === retries) return result;
    } catch (err) {
      if (attempt === retries) {
        return {
          agent: agentId,
          result: `Error después de ${retries + 1} intentos: ${err instanceof Error ? err.message : String(err)}`,
          tokens: 0,
          durationMs: 0,
          status: 'error',
        };
      }
    }
  }

  return { agent: agentId, result: 'Error inesperado', tokens: 0, durationMs: 0, status: 'error' };
}

export async function runAgentsParallel(
  task: string,
  agentIds: string[],
  context?: Record<string, unknown>
): Promise<{ results: AgentResult[]; totalMs: number }> {
  const start = Date.now();

  // Load configs from Supabase
  const configs = await supabaseQuery<AgentConfig>('agent_config', 'GET', {
    filter: `agent_id=in.(${agentIds.join(',')})`,
  }).catch(() => [] as AgentConfig[]);

  const configMap = new Map(configs.map(c => [c.agent_id, c]));

  const contextStr = context ? `\n\nContexto: ${JSON.stringify(context)}` : '';
  const fullTask = task + contextStr;

  const promises = agentIds.map(agentId => {
    const cfg = configMap.get(agentId);
    return runWithRetry(agentId, fullTask, {
      model: cfg?.model,
      systemPrompt: cfg?.system_prompt,
      maxTokens: cfg?.max_tokens,
      temperature: cfg?.temperature,
    });
  });

  const settled = await Promise.allSettled(promises);
  const results = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    return {
      agent: agentIds[i],
      result: `Error: ${s.reason}`,
      tokens: 0,
      durationMs: 0,
      status: 'error' as const,
    };
  });

  // Log all results to Supabase (fire-and-forget)
  for (const r of results) {
    supabaseInsert('agent_logs', {
      agent_id: r.agent,
      agent_name: r.agent,
      action: 'parallel_execute',
      detail: r.result.substring(0, 500),
      status: r.status,
    }).catch(() => {});
  }

  return { results, totalMs: Date.now() - start };
}

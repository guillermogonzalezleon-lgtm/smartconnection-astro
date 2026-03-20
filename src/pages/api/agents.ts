export const prerender = false;

import type { APIRoute } from 'astro';
import { verifySession } from './auth';

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = import.meta.env.SUPABASE_SERVICE_KEY;

// API keys from env
const API_KEYS: Record<string, string | undefined> = {
  claude: import.meta.env.ANTHROPIC_API_KEY,
  gpt4: import.meta.env.OPENAI_API_KEY,
  grok: import.meta.env.GROK_API_KEY,
  gemini: import.meta.env.GEMINI_API_KEY,
};

// Agent API configs
const AGENT_ENDPOINTS: Record<string, { url: string; buildRequest: (prompt: string, model: string, apiKey: string) => { headers: Record<string, string>; body: string }; parseResponse: (data: any) => string }> = {
  claude: {
    url: 'https://api.anthropic.com/v1/messages',
    buildRequest: (prompt, model, apiKey) => ({
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    }),
    parseResponse: (data) => data.content?.[0]?.text || 'Sin respuesta',
  },
  gpt4: {
    url: 'https://api.openai.com/v1/chat/completions',
    buildRequest: (prompt, model, apiKey) => ({
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
      }),
    }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || 'Sin respuesta',
  },
  grok: {
    url: 'https://api.x.ai/v1/chat/completions',
    buildRequest: (prompt, model, apiKey) => ({
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
      }),
    }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || 'Sin respuesta',
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    buildRequest: (prompt, model, apiKey) => ({
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048 },
      }),
    }),
    parseResponse: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta',
  },
};

async function supabaseQuery(path: string, method = 'GET', body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=representation' : '',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  return res.json();
}

async function logAgentAction(agentId: string, agentName: string, action: string, detail: string, status = 'success') {
  await supabaseQuery('agent_logs', 'POST', {
    agent_id: agentId,
    agent_name: agentName,
    action,
    detail: detail.substring(0, 500),
    status,
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  // Verify auth
  const session = verifySession(cookies.get('sc_session')?.value);
  if (!session.valid) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { action, agentId, prompt, taskType } = await request.json();

    // Get all agents config
    if (action === 'list') {
      const allAgents = await supabaseQuery('agent_config?order=agent_id');
      return new Response(JSON.stringify({ agents: allAgents }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get logs
    if (action === 'logs') {
      const logs = await supabaseQuery(`agent_logs?agent_id=eq.${agentId}&order=created_at.desc&limit=20`);
      return new Response(JSON.stringify({ logs }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get agent config from Supabase
    const agents = await supabaseQuery(`agent_config?agent_id=eq.${agentId}&limit=1`);
    if (!agents || agents.length === 0) {
      return new Response(JSON.stringify({ error: 'Agente no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const agent = agents[0];

    if (action === 'toggle') {
      await fetch(`${SUPABASE_URL}/rest/v1/agent_config?agent_id=eq.${agentId}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active: !agent.active, updated_at: new Date().toISOString() }),
      });

      await logAgentAction(agentId, agent.name, 'toggle', `${agent.active ? 'Desactivado' : 'Activado'}`);

      return new Response(JSON.stringify({ success: true, active: !agent.active }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'execute') {
      if (!agent.active) {
        return new Response(JSON.stringify({ error: 'Agente inactivo' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Special case: deployer doesn't use an AI API
      if (agentId === 'deployer') {
        await logAgentAction(agentId, agent.name, taskType || 'deploy', 'Deploy trigger solicitado');
        return new Response(JSON.stringify({
          success: true,
          result: 'Deploy se ejecuta automaticamente via GitHub Actions al hacer push a main.',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const apiKey = API_KEYS[agentId];
      if (!apiKey) {
        await logAgentAction(agentId, agent.name, 'execute', 'API key no configurada', 'error');
        return new Response(JSON.stringify({ error: `API key no configurada para ${agent.name}. Agrega ${agent.api_key_env} en Vercel.` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const endpoint = AGENT_ENDPOINTS[agentId];
      if (!endpoint) {
        return new Response(JSON.stringify({ error: 'Endpoint no configurado' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Build system context based on task type
      const systemContext: Record<string, string> = {
        'code-review': 'Eres un experto en code review. Analiza el codigo y sugiere mejoras de calidad, rendimiento y seguridad. Responde en espanol.',
        'content': 'Eres un copywriter experto en tecnologia y SAP. Genera contenido profesional para el sitio web de Smart Connection. Responde en espanol.',
        'seo': 'Eres un experto en SEO tecnico. Analiza y sugiere mejoras de posicionamiento para un sitio de consultoria SAP e IA en Chile. Responde en espanol.',
        'research': 'Eres un analista de mercado tecnologico. Investiga tendencias en SAP, IA empresarial y consultoria en Chile y Latinoamerica. Responde en espanol.',
        'general': 'Eres un asistente de Smart Connection, empresa chilena de consultoria SAP y desarrollo con IA. Responde en espanol.',
      };

      const fullPrompt = `${systemContext[taskType] || systemContext.general}\n\n${prompt}`;
      const model = agent.model || 'default';

      let url = endpoint.url;
      if (agentId === 'gemini') {
        url = url.replace('{model}', model);
      }

      const { headers, body } = endpoint.buildRequest(fullPrompt, model, apiKey);

      const aiRes = await fetch(url, { method: 'POST', headers, body });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error(`${agent.name} API error:`, errText);
        await logAgentAction(agentId, agent.name, taskType || 'execute', `Error: ${aiRes.status}`, 'error');
        return new Response(JSON.stringify({ error: `Error de ${agent.name}: ${aiRes.status}` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const aiData = await aiRes.json();
      const result = endpoint.parseResponse(aiData);

      await logAgentAction(agentId, agent.name, taskType || 'execute', result.substring(0, 500));

      return new Response(JSON.stringify({ success: true, result }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Accion no valida' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Agents API error:', err);
    return new Response(JSON.stringify({ error: 'Error interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

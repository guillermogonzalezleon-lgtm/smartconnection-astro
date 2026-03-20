const SUPABASE_URL = import.meta.env.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = import.meta.env.SUPABASE_SERVICE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export async function supabaseQuery<T = unknown>(
  table: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  options: {
    body?: Record<string, unknown>;
    filter?: string;
    select?: string;
    order?: string;
    limit?: number;
  } = {}
): Promise<T[]> {
  const params = new URLSearchParams();
  if (options.select) params.set('select', options.select);
  if (options.order) params.set('order', options.order);
  if (options.limit) params.set('limit', String(options.limit));

  const filterPart = options.filter ? `&${options.filter}` : '';
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}${filterPart}`;

  const headers: Record<string, string> = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  if (method === 'POST') headers['Prefer'] = 'return=representation';

  const res = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${table}: ${res.status} ${err}`);
  }

  if (res.status === 204) return [] as T[];
  return res.json();
}

export async function supabaseInsert<T = unknown>(
  table: string,
  data: Record<string, unknown>
): Promise<T[]> {
  return supabaseQuery<T>(table, 'POST', { body: data });
}

export async function supabaseUpdate(
  table: string,
  filter: string,
  data: Record<string, unknown>
): Promise<void> {
  await supabaseQuery(table, 'PATCH', { body: data, filter });
}

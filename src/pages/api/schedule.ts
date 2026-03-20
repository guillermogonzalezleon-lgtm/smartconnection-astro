export const prerender = false;

import type { APIRoute } from 'astro';
import { createMeeting } from '../../lib/calendar';
import { supabaseInsert } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { nombre, email, fecha, hora, tema } = await request.json();

    if (!nombre || !email || !fecha || !hora) {
      return new Response(JSON.stringify({ error: 'Campos requeridos faltantes' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await createMeeting({ nombre, email, fecha, hora, tema: tema || 'General' });

    await supabaseInsert('reuniones', {
      nombre, email, fecha, hora, tema,
      estado: result.eventId ? 'confirmed' : 'pending',
    }).catch(() => {});

    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

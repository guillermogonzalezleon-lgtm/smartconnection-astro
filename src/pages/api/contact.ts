export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseInsert } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'contact') {
      const { nombre, empresa, email, telefono, servicio, mensaje, website } = body;
      if (!nombre || !email || !servicio || !mensaje) {
        return new Response(JSON.stringify({ error: 'Campos requeridos faltantes' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      if (website) {
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      const record = await supabaseInsert('leads', { nombre, empresa, email, telefono, servicio, mensaje, fuente: 'website', estado: 'nuevo' });
      return new Response(JSON.stringify({ success: true, id: record[0]?.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'scheduler') {
      const { nombre, email, fecha, hora, tema } = body;
      if (!nombre || !email || !fecha || !hora) {
        return new Response(JSON.stringify({ error: 'Campos requeridos faltantes' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      const record = await supabaseInsert('reuniones', { nombre, email, fecha, hora, tema, estado: 'pendiente' });
      return new Response(JSON.stringify({ success: true, id: record[0]?.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Acción no válida' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

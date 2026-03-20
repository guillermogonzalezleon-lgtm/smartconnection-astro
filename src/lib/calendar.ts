const GOOGLE_SA = import.meta.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const CALENDAR_ID = import.meta.env.GOOGLE_CALENDAR_ID || 'contacto@smconnection.cl';

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\n/g, '');
  const binary = atob(b64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
  return buffer.buffer;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(): Promise<string> {
  const sa = JSON.parse(GOOGLE_SA || '{}');
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claim = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
    sub: CALENDAR_ID,
  }));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${claim}`)
  );

  const jwt = `${header}.${claim}.${arrayBufferToBase64Url(signature)}`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

export interface CalendarEvent {
  nombre: string;
  email: string;
  fecha: string;
  hora: string;
  tema: string;
}

export interface CalendarResult {
  success: boolean;
  eventId?: string;
  meetLink?: string;
  htmlLink?: string;
  fallbackUrl?: string;
}

export async function createMeeting(event: CalendarEvent): Promise<CalendarResult> {
  const [h, m] = event.hora.split(':').map(Number);
  const endH = m + 30 >= 60 ? h + 1 : h;
  const endM = (m + 30) % 60;

  if (!GOOGLE_SA) {
    const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Reunión Smart Connection — ' + event.tema)}&dates=${event.fecha.replace(/-/g, '')}T${event.hora.replace(':', '')}00/${event.fecha.replace(/-/g, '')}T${String(endH).padStart(2, '0')}${String(endM).padStart(2, '0')}00&ctz=America/Santiago&details=${encodeURIComponent(`Contacto: ${event.nombre} (${event.email})`)}&add=contacto@smconnection.cl`;
    return { success: true, fallbackUrl: calUrl };
  }

  const accessToken = await getAccessToken();
  const calEvent = {
    summary: `Reunión Smart Connection — ${event.tema}`,
    description: `Contacto: ${event.nombre} (${event.email})\nTema: ${event.tema}`,
    start: { dateTime: `${event.fecha}T${event.hora}:00`, timeZone: 'America/Santiago' },
    end: { dateTime: `${event.fecha}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`, timeZone: 'America/Santiago' },
    attendees: [{ email: 'contacto@smconnection.cl' }, { email: event.email }],
    conferenceData: { createRequest: { requestId: `sc-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 60 }, { method: 'popup', minutes: 15 }] },
  };

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?conferenceDataVersion=1&sendUpdates=all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(calEvent),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Calendar error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return {
    success: true,
    eventId: data.id,
    meetLink: data.hangoutLink || data.conferenceData?.entryPoints?.[0]?.uri,
    htmlLink: data.htmlLink,
  };
}

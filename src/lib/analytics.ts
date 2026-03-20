import { supabaseInsert } from './supabase';

export interface AnalyticsEvent {
  event?: string;
  page?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  referrer?: string;
  lang?: string;
  userAgent?: string;
}

export async function trackEvent(data: AnalyticsEvent): Promise<void> {
  await supabaseInsert('analytics', {
    event: data.event || 'pageview',
    source: data.source || 'direct',
    medium: data.medium || 'none',
    campaign: data.campaign || null,
    page: data.page || '/',
    referrer: data.referrer || null,
    lang: data.lang || 'es',
    user_agent: data.userAgent || null,
  }).catch(() => {});
}

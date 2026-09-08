import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
    readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
        .split(/\r?\n/)
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
            const separator = line.indexOf('=');
            return [line.slice(0, separator), line.slice(separator + 1)];
        })
);

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

const { data, error } = await client
    .from('events')
    .select('id,title,status,source,registered_count,max_attendees')
    .order('event_time');

if (error) throw error;
if (!Array.isArray(data) || data.length < 2) {
    throw new Error(`Expected at least 2 public seed events, received ${data?.length ?? 0}`);
}
if (data.some(event => event.status !== 'published' || event.source !== 'seed')) {
    throw new Error('Anonymous access returned a non-public event');
}

console.log(`Smoke test passed: anonymous client read ${data.length} published events.`);

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function isValidUrl(url: string | undefined): url is string {
    if (!url || url.trim().length === 0 || url.toLowerCase().includes('placeholder')) return false;
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

function isValidKey(key: string | undefined): key is string {
    return !!key && key.trim() !== '' && key.toLowerCase() !== 'placeholder';
}

const isConfigured = isValidUrl(SUPABASE_URL) && isValidKey(SUPABASE_ANON_KEY);

if (!isConfigured) {
    console.warn(
        "[Supabase] Missing or invalid environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). " +
        "Database and auth features will be unavailable. Configure them in your .env file."
    );
}

/**
 * Creates a safe no-op Supabase client proxy that returns controlled errors
 * instead of crashing the app when Supabase is not configured.
 */
function createSafeClient(): SupabaseClient {
    const notConfiguredError = { message: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.', code: 'NOT_CONFIGURED' };

    // Chainable query builder mock that resolves to a controlled error
    const createQueryChain = (): any => {
        const chain: any = {
            select: () => chain,
            insert: () => chain,
            update: () => chain,
            upsert: () => chain,
            delete: () => chain,
            eq: () => chain,
            neq: () => chain,
            gt: () => chain,
            lt: () => chain,
            gte: () => chain,
            lte: () => chain,
            like: () => chain,
            ilike: () => chain,
            is: () => chain,
            in: () => chain,
            order: () => chain,
            limit: () => chain,
            range: () => chain,
            single: () => chain,
            maybeSingle: () => chain,
            csv: () => chain,
            then: (resolve: any) => resolve({ data: null, error: notConfiguredError, count: null, status: 500, statusText: 'Supabase Not Configured' }),
        };
        return chain;
    };

    const safeClient = {
        from: () => createQueryChain(),
        rpc: () => Promise.resolve({ data: null, error: notConfiguredError }),
        channel: (name: string) => ({
            on: function () { return this; },
            subscribe: () => ({ unsubscribe: () => {} }),
        }),
        removeChannel: () => Promise.resolve('ok'),
        auth: {
            getUser: () => Promise.resolve({ data: { user: null }, error: notConfiguredError }),
            getSession: () => Promise.resolve({ data: { session: null }, error: notConfiguredError }),
            signOut: () => Promise.resolve({ error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        },
    };

    return safeClient as unknown as SupabaseClient;
}

export const supabase: SupabaseClient = isConfigured
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : createSafeClient();

/** Whether Supabase is properly configured with real credentials */
export const isSupabaseConfigured = isConfigured;

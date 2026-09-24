import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

/**
 * What every Supabase implementation of the `lib/data` contracts runs with: a client (the
 * signed-in user's on the web, service role in the bot) and the `usuarios` row it acts for.
 * Every query filters on `usuarioId` explicitly, so the same code is correct with or without RLS.
 */
export type DataContext = {
  client: SupabaseClient
  usuarioId: string
  currency: string
  timezone: string
}

/**
 * Rejects a write that failed or matched no row (D13): RLS filters a foreign id to zero rows
 * instead of raising, and the contracts require a rejection with nothing changed.
 */
export function expectRows({ data, error }: { data: unknown[] | null; error: PostgrestError | null }): void {
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('not-found')
}

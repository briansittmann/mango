import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cliente: SupabaseClient | null = null

/**
 * Cliente de Supabase con `service_role`: **saltea RLS**. Solo para el cron de
 * fijos y las escrituras del webhook (ARCHITECTURE.md §2).
 *
 * El import de `server-only` rompe el build si este módulo entra en un bundle
 * de cliente: con esta clave expuesta, cualquiera lee y escribe los gastos de
 * todos. Las variables se leen dentro de la función, no en el módulo, para que
 * salgan del entorno en tiempo de ejecución.
 */
export function supabaseAdmin(): SupabaseClient {
  if (cliente) return cliente

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRole) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
  }

  // TODO: tipar el cliente con los tipos generados por `supabase gen types`
  // cuando el esquema esté aplicado en el proyecto.
  cliente = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return cliente
}

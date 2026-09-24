import type { SavingsMutations } from '@/lib/data/savings'
import { expectRows, type DataContext } from './context'

/** `SavingsMutations` over `transacciones` rows with `tipo = 'ahorro'`; a withdrawal is stored negative (D13). */
export function createSupabaseSavingsMutations({ client, usuarioId, currency }: DataContext): SavingsMutations {
  return {
    async addSavingsMovement(draft) {
      expectRows(
        await client
          .from('transacciones')
          .insert({
            usuario_id: usuarioId,
            tipo: 'ahorro',
            categoria_id: null,
            monto: draft.kind === 'withdrawal' ? -draft.amount : draft.amount,
            moneda: currency,
            fecha: `${draft.date}T12:00:00Z`,
            descripcion: draft.name,
          })
          .select('id'),
      )
    },
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DUPLICATE_CATEGORY_NAME, type CategoryDraft } from "@/lib/data/categories";
import type { ExpenseDraft } from "@/lib/data/expenses";
import type { IncomeDraft } from "@/lib/data/income";
import type { RecurringDraft, RecurringTarget } from "@/lib/data/recurring";
import type { SavingsMovementDraft } from "@/lib/data/savings";
import { createSupabaseCategoryMutations } from "@/lib/data/supabase/categories";
import type { DataContext } from "@/lib/data/supabase/context";
import { createSupabaseExpenseMutations } from "@/lib/data/supabase/expenses";
import { createSupabaseIncomeMutations } from "@/lib/data/supabase/income";
import { createSupabaseRecurringMutations } from "@/lib/data/supabase/recurring";
import { createSupabaseSavingsMutations } from "@/lib/data/supabase/savings";
import { findCurrentUsuario } from "@/lib/data/supabase/user";
import { supabaseServer } from "@/lib/supabase/server";

// One action per contract operation (D2): each runs as the signed-in user through RLS and
// revalidates the page, so the dashboard re-renders from the stored rows.

async function context(): Promise<DataContext> {
  const client = await supabaseServer();
  const usuario = await findCurrentUsuario(client);
  if (!usuario) throw new Error("unlinked-account");
  return { client, usuarioId: usuario.id, currency: usuario.moneda_default, timezone: usuario.timezone };
}

async function run<T>(operation: (ctx: DataContext) => Promise<T>): Promise<T> {
  const result = await operation(await context());
  revalidatePath("/dashboard");
  return result;
}

/**
 * Production builds replace a thrown action's message with a generic one, so the duplicate-name
 * rejection travels as a value and the client wrapper turns it back into the contract's error.
 */
async function catchDuplicateName<T>(operation: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    if (error instanceof Error && error.message === DUPLICATE_CATEGORY_NAME) return { ok: false };
    throw error;
  }
}

export async function createExpense(categoryId: string, draft: ExpenseDraft) {
  await run((ctx) => createSupabaseExpenseMutations(ctx).create(categoryId, draft));
}
export async function updateExpense(expenseId: string, draft: ExpenseDraft) {
  await run((ctx) => createSupabaseExpenseMutations(ctx).update(expenseId, draft));
}
export async function softDeleteExpense(expenseId: string) {
  await run((ctx) => createSupabaseExpenseMutations(ctx).softDelete(expenseId));
}
export async function restoreExpense(expenseId: string) {
  await run((ctx) => createSupabaseExpenseMutations(ctx).restore(expenseId));
}

export async function createIncome(draft: IncomeDraft) {
  await run((ctx) => createSupabaseIncomeMutations(ctx).create(draft));
}
export async function updateIncome(entryId: string, draft: IncomeDraft) {
  await run((ctx) => createSupabaseIncomeMutations(ctx).update(entryId, draft));
}
export async function softDeleteIncome(entryId: string) {
  await run((ctx) => createSupabaseIncomeMutations(ctx).softDelete(entryId));
}
export async function restoreIncome(entryId: string) {
  await run((ctx) => createSupabaseIncomeMutations(ctx).restore(entryId));
}

export async function addSavingsMovement(draft: SavingsMovementDraft) {
  await run((ctx) => createSupabaseSavingsMutations(ctx).addSavingsMovement(draft));
}

export async function createCategory(draft: CategoryDraft) {
  return catchDuplicateName(() => run((ctx) => createSupabaseCategoryMutations(ctx).create(draft)));
}
export async function updateCategory(categoryId: string, draft: CategoryDraft) {
  return catchDuplicateName(() => run((ctx) => createSupabaseCategoryMutations(ctx).update(categoryId, draft)));
}
export async function deleteCategory(categoryId: string, reassignTo: string | null) {
  await run((ctx) => createSupabaseCategoryMutations(ctx).delete(categoryId, reassignTo));
}
export async function reorderCategories(categoryIds: string[]) {
  await run((ctx) => createSupabaseCategoryMutations(ctx).reorder(categoryIds));
}

export async function createRecurring(target: RecurringTarget, draft: RecurringDraft) {
  await run((ctx) => createSupabaseRecurringMutations(ctx).create(target, draft));
}
export async function updateRecurring(definitionId: string, draft: RecurringDraft) {
  await run((ctx) => createSupabaseRecurringMutations(ctx).update(definitionId, draft));
}
export async function stopRecurring(definitionId: string) {
  await run((ctx) => createSupabaseRecurringMutations(ctx).stop(definitionId));
}
export async function deleteRecurring(definitionId: string) {
  await run((ctx) => createSupabaseRecurringMutations(ctx).delete(definitionId));
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}

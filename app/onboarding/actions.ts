"use server";

import { revalidatePath } from "next/cache";
import { DUPLICATE_CATEGORY_NAME, type CategoryDeleteTarget, type CategoryDraft, type CategoryUpdateTarget } from "@/lib/data/categories";
import type { LocalDate } from "@/lib/data/expenses";
import { PROFILE_ERRORS, validateBasics, type ProfileBasics } from "@/lib/data/profile";
import type { RecurringDraft, RecurringTarget } from "@/lib/data/recurring";
import { createSupabaseCategoryMutations } from "@/lib/data/supabase/categories";
import type { DataContext } from "@/lib/data/supabase/context";
import { materializeCurrentCycle as materialize } from "@/lib/data/supabase/onboarding";
import { createSupabaseProfileMutations } from "@/lib/data/supabase/profile";
import { createSupabaseRecurringMutations } from "@/lib/data/supabase/recurring";
import { findCurrentUsuario, type Usuario } from "@/lib/data/supabase/user";
import { supabaseServer } from "@/lib/supabase/server";

// One action per `OnboardingActions` operation (D2): each runs as the signed-in user through RLS,
// with the same `DataContext` as `/dashboard`, and revalidates the page so it re-renders from the
// stored rows.

type Known = (typeof PROFILE_ERRORS)[number] | typeof DUPLICATE_CATEGORY_NAME;

/** A contract rejection as a value: production builds replace a thrown action's message with a generic one. */
export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: Known };

const KNOWN: readonly string[] = [...PROFILE_ERRORS, DUPLICATE_CATEGORY_NAME];

async function load(): Promise<{ ctx: DataContext; usuario: Usuario }> {
  const client = await supabaseServer();
  const usuario = await findCurrentUsuario(client);
  if (!usuario) throw new Error("unlinked-account");
  return { ctx: { client, usuarioId: usuario.id, currency: usuario.moneda_default, timezone: usuario.timezone }, usuario };
}

async function run<T>(operation: (ctx: DataContext, usuario: Usuario) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const { ctx, usuario } = await load();
    const value = await operation(ctx, usuario);
    revalidatePath("/onboarding");
    return { ok: true, value };
  } catch (error) {
    if (error instanceof Error && KNOWN.includes(error.message)) return { ok: false, error: error.message as Known };
    throw error;
  }
}

// Profile (D3)

export async function updateProfileBasics(basics: ProfileBasics) {
  // Validation runs here, not in the browser: the values are the user's to send, not to trust.
  return run((ctx) => createSupabaseProfileMutations(ctx).updateBasics(validateBasics(basics)));
}
export async function setSavingsTarget(amount: number | null) {
  return run((ctx) => createSupabaseProfileMutations(ctx).setSavingsTarget(amount));
}
/** The closing step's linking code (`whatsapp-linking`): the live one, or a new one. Sends nothing. */
export async function requestWhatsAppLink() {
  return run((ctx) => createSupabaseProfileMutations(ctx).requestWhatsAppLink());
}
/** The optional phone, converted by the chosen country's rules on the server (D8). */
export async function requestWhatsApp(phone: string, country: string) {
  return run((ctx) => createSupabaseProfileMutations(ctx).requestWhatsApp(phone, country));
}
export async function setOnboardingStep(step: number) {
  return run((ctx) => createSupabaseProfileMutations(ctx).setStep(step));
}

// Categories and definitions: the dashboard's own contracts (D2)

export async function createCategory(draft: CategoryDraft, cycle: LocalDate, scope: "only" | "onward") {
  return run((ctx) => createSupabaseCategoryMutations(ctx).create(draft, cycle, scope));
}
export async function updateCategory(categoryId: string, draft: CategoryDraft, target: CategoryUpdateTarget) {
  return run((ctx) => createSupabaseCategoryMutations(ctx).update(categoryId, draft, target));
}
export async function deleteCategory(categoryId: string, reassignTo: string | null, target: CategoryDeleteTarget) {
  return run((ctx) => createSupabaseCategoryMutations(ctx).delete(categoryId, reassignTo, target));
}
export async function reorderCategories(categoryIds: string[]) {
  return run((ctx) => createSupabaseCategoryMutations(ctx).reorder(categoryIds));
}

export async function createRecurring(target: RecurringTarget, draft: RecurringDraft) {
  return run((ctx) => createSupabaseRecurringMutations(ctx).create(target, draft));
}
export async function updateRecurring(definitionId: string, draft: RecurringDraft) {
  return run((ctx) => createSupabaseRecurringMutations(ctx).update(definitionId, draft));
}
export async function stopRecurring(definitionId: string) {
  return run((ctx) => createSupabaseRecurringMutations(ctx).stop(definitionId));
}
export async function deleteRecurring(definitionId: string) {
  return run((ctx) => createSupabaseRecurringMutations(ctx).delete(definitionId));
}

// The charges of the cycle in progress (D9) and the close (D11)

export async function materializeCurrentCycle() {
  return run((ctx) => materialize(ctx));
}
export async function finishOnboarding() {
  return run(async (ctx) => {
    await materialize(ctx);
    await createSupabaseProfileMutations(ctx).complete();
    revalidatePath("/dashboard");
  });
}

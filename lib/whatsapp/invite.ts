/**
 * Whether an unknown WhatsApp number needs an invitation code (ARCHITECTURE.md §4, design.md
 * D5). Only the exact value `'false'` turns the requirement off; a missing variable or any
 * other value keeps it on — failing closed on a typo is the safe side.
 */
export function isInviteRequired(value: string | undefined): boolean {
  return value !== 'false'
}

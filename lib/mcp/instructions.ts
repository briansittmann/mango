// Pure: the bot's agent (`lib/bot/agent-tools.ts`) and its eval read these rules too.

/** What the assistant reads about Mango once, at `initialize` (`mcp-server` → *One remote endpoint*). */
export const MCP_INSTRUCTIONS = [
  "Mango is a personal finance app. These tools read and change the signed-in person's own account, nothing else.",
  "Money is organised in cycles: a cycle runs from the account's start day to the day before it next month, and is named by the month it ends in (YYYY-MM). Without a month, a tool acts on the cycle in progress; up to six later cycles are projections built from the fixed charges.",
  'Amounts are plain numbers in the currency each result names. Dates are YYYY-MM-DD in the account\'s timezone.',
  'Deleting a single movement can be undone with restore_movement. Changing anything that repeats (a fixed charge, a budget or a category in a later cycle) asks for a scope: only_this_month or from_this_month. Ask the person which one they mean when they did not say.',
  'Before a delete or an update, read the item first and confirm with the person when it is not obvious which one they mean.',
].join('\n')

/**
 * Wallet Testing Utilities
 * Shared utilities for testing Rapyd wallet operations with real endpoints
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { checkWalletBalance } from "../_shared/rapyd-utils.ts";

// ANSI color codes for console output
export const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

// Emoji indicators
export const emoji = {
  search: "🔍",
  money: "💰",
  transfer: "💸",
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
  wallet: "💼",
  user: "👤",
  database: "🗄️",
  clock: "🕐",
};

/**
 * Create Supabase admin client from environment variables
 */
export function createSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * User data with wallet information
 */
export interface UserWalletData {
  id: string;
  email: string;
  rapyd_wallet_id: string | null;
  rapyd_customer_id: string | null;
  rapyd_payment_method_id: string | null;
  payment_setup_completed: boolean;
}

/**
 * Wallet state snapshot
 */
export interface WalletState {
  timestamp: string;
  userId: string;
  userEmail: string;
  walletId: string;
  balance: number;
  currency: string;
  dbTransactionCount?: number;
  lastTransaction?: any;
}

/**
 * Test result structure
 */
export interface TestResult {
  success: boolean;
  operation: string;
  initialState: WalletState | null;
  finalState: WalletState | null;
  balanceChange?: number;
  error?: string;
  details?: any;
}

/**
 * Get user data by ID or email
 */
export async function getUserData(
  supabase: SupabaseClient,
  identifier: string
): Promise<UserWalletData> {
  // Check if identifier is an email (contains @) or UUID
  const isEmail = identifier.includes("@");

  const query = supabase
    .from("users")
    .select(
      "id, email, rapyd_wallet_id, rapyd_customer_id, rapyd_payment_method_id, payment_setup_completed"
    );

  const { data, error } = isEmail
    ? await query.eq("email", identifier).single()
    : await query.eq("id", identifier).single();

  if (error || !data) {
    throw new Error(`User not found: ${identifier}. Error: ${error?.message}`);
  }

  return data as UserWalletData;
}

/**
 * Get current wallet state from Rapyd and database
 */
export async function getWalletState(
  supabase: SupabaseClient,
  userId: string,
  currency: string = "ILS"
): Promise<WalletState> {
  const userData = await getUserData(supabase, userId);

  if (!userData.rapyd_wallet_id) {
    throw new Error(
      `User ${userId} (${userData.email}) does not have a Rapyd wallet`
    );
  }

  // Get balance from Rapyd
  const balance = await checkWalletBalance(userData.rapyd_wallet_id, currency);

  // Get transaction count from database
  const { count: transactionCount } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .or(`payer_id.eq.${userId},receiver_id.eq.${userId}`);

  // Get most recent transaction
  const { data: lastTransaction } = await supabase
    .from("transactions")
    .select("*")
    .or(`payer_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return {
    timestamp: new Date().toISOString(),
    userId: userData.id,
    userEmail: userData.email,
    walletId: userData.rapyd_wallet_id,
    balance: balance,
    currency: currency,
    dbTransactionCount: transactionCount || 0,
    lastTransaction: lastTransaction || null,
  };
}

/**
 * Log wallet state with nice formatting
 */
export function logWalletState(
  state: WalletState,
  label: string = "Wallet State"
): void {
  console.log(
    `\n${colors.bright}${colors.cyan}═══ ${label} ═══${colors.reset}`
  );
  console.log(
    `${emoji.clock} Timestamp: ${colors.yellow}${state.timestamp}${colors.reset}`
  );
  console.log(
    `${emoji.user} User: ${colors.white}${state.userEmail}${colors.reset} (${state.userId})`
  );
  console.log(
    `${emoji.wallet} Wallet ID: ${colors.white}${state.walletId}${colors.reset}`
  );
  console.log(
    `${emoji.money} Balance: ${colors.green}${state.balance} ${state.currency}${colors.reset}`
  );
  console.log(
    `${emoji.database} DB Transactions: ${colors.white}${state.dbTransactionCount}${colors.reset}`
  );

  if (state.lastTransaction) {
    console.log(
      `${emoji.info} Last Transaction: ${colors.white}${state.lastTransaction.rapyd_payment_id}${colors.reset} (${state.lastTransaction.status})`
    );
  }
  console.log(`${colors.cyan}═══════════════════════════${colors.reset}\n`);
}

/**
 * Compare two wallet states and log the differences
 */
export function compareStates(initial: WalletState, final: WalletState): void {
  console.log(
    `\n${colors.bright}${colors.magenta}═══ State Comparison ═══${colors.reset}`
  );

  const balanceChange = final.balance - initial.balance;
  const balanceColor =
    balanceChange > 0
      ? colors.green
      : balanceChange < 0
      ? colors.red
      : colors.yellow;

  console.log(
    `${emoji.money} Balance Change: ${balanceColor}${
      balanceChange > 0 ? "+" : ""
    }${balanceChange} ${final.currency}${colors.reset}`
  );
  console.log(
    `   ${colors.white}${initial.balance} ${initial.currency}${colors.reset} → ${colors.white}${final.balance} ${final.currency}${colors.reset}`
  );

  const transactionChange =
    (final.dbTransactionCount || 0) - (initial.dbTransactionCount || 0);
  console.log(
    `${emoji.database} New Transactions: ${colors.white}${transactionChange}${colors.reset}`
  );

  const timeDiff =
    new Date(final.timestamp).getTime() - new Date(initial.timestamp).getTime();
  console.log(
    `${emoji.clock} Time Elapsed: ${colors.white}${timeDiff}ms${colors.reset}`
  );

  console.log(`${colors.magenta}════════════════════════${colors.reset}\n`);
}

/**
 * Log test result with formatting
 */
export function logTestResult(result: TestResult): void {
  const statusEmoji = result.success ? emoji.success : emoji.error;
  const statusColor = result.success ? colors.green : colors.red;

  console.log(
    `\n${colors.bright}${statusColor}${statusEmoji} Test Result: ${result.operation}${colors.reset}`
  );
  console.log(
    `${colors.white}Status: ${statusColor}${
      result.success ? "SUCCESS" : "FAILED"
    }${colors.reset}`
  );

  if (result.error) {
    console.log(
      `${emoji.error} Error: ${colors.red}${result.error}${colors.reset}`
    );
  }

  if (result.balanceChange !== undefined) {
    const changeColor =
      result.balanceChange > 0
        ? colors.green
        : result.balanceChange < 0
        ? colors.red
        : colors.yellow;
    console.log(
      `${emoji.money} Balance Change: ${changeColor}${
        result.balanceChange > 0 ? "+" : ""
      }${result.balanceChange}${colors.reset}`
    );
  }

  if (result.details) {
    console.log(`${emoji.info} Details:`, result.details);
  }

  console.log();
}

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith("--")) {
        parsed[key] = value;
        i++; // Skip next arg since we used it as value
      } else {
        parsed[key] = "true"; // Flag without value
      }
    } else if (!parsed.command) {
      parsed.command = arg; // First non-flag arg is the command
    }
  }

  return parsed;
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(): void {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "RAPYD_ACCESS_KEY",
    "RAPYD_SECRET_KEY",
    "RAPYD_API_BASE_URL",
  ];

  const missing = required.filter((key) => !Deno.env.get(key));

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        `Please ensure your .env file is properly configured.`
    );
  }
}

/**
 * Print test header
 */
export function printTestHeader(testName: string): void {
  const line = "═".repeat(testName.length + 8);
  console.log(`\n${colors.bright}${colors.blue}${line}${colors.reset}`);
  console.log(
    `${colors.bright}${colors.blue}═══ ${testName} ═══${colors.reset}`
  );
  console.log(`${colors.bright}${colors.blue}${line}${colors.reset}\n`);
}

/**
 * Print section header
 */
export function printSection(sectionName: string): void {
  console.log(
    `\n${colors.bright}${colors.cyan}▶ ${sectionName}${colors.reset}\n`
  );
}

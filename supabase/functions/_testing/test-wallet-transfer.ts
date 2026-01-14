/**
 * Test Wallet-to-Wallet Transfer
 * 
 * This test performs a complete two-step transfer between Rapyd wallets:
 * 1. Initiate transfer (POST /v1/ewallets/transfer) - returns status "PEN" (pending)
 * 2. Accept transfer (POST /v1/ewallets/transfer/response) - returns status "CLO" (closed)
 * 
 * Usage:
 *   deno run --allow-all supabase/functions/_testing/test-wallet-transfer.ts
 * 
 * Test Configuration:
 *   - Sender Wallet: ewallet_c7bedc40ee65e387c98235dda289eb65
 *   - Receiver Wallet: ewallet_59afe633b775c8572810e26f1c275bb3
 *   - Amount: 1000 ILS
 * 
 * Environment Variables (from kahol-lavan/supabase/.env):
 *   - RAPYD_ACCESS_KEY
 *   - RAPYD_SECRET_KEY
 *   - RAPYD_API_BASE_URL
 */

import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";
import {
  makeRapydRequest,
  checkWalletBalance,
  transferFundsBetweenWallets,
  acceptTransfer,
} from "../_shared/rapyd-utils.ts";
import {
  validateEnvironment,
  printTestHeader,
  printSection,
  colors,
  emoji,
} from "./wallet-test-utils.ts";

// Test configuration
const SENDER_WALLET_ID = "ewallet_c7bedc40ee65e387c98235dda289eb65";
const RECEIVER_WALLET_ID = "ewallet_59afe633b775c8572810e26f1c275bb3";
const TRANSFER_AMOUNT = 1000;
const CURRENCY = "ILS";

/**
 * Get detailed wallet information from Rapyd
 */
async function getWalletInfo(walletId: string) {
  try {
    const walletPath = `/v1/ewallets/${walletId}`;
    const walletInfo = await makeRapydRequest("GET", walletPath);
    return walletInfo.data;
  } catch (error) {
    console.error(`${emoji.error} Failed to get wallet info: ${error.message}`);
    return null;
  }
}

/**
 * Main test function
 */
async function testWalletTransfer() {
  printTestHeader("WALLET-TO-WALLET TRANSFER TEST");

  try {
    // ========== STEP 0: Check Initial Balances ==========
    printSection("Step 0: Check Initial Wallet Balances");
    
    console.log(`${emoji.wallet} Sender Wallet: ${colors.white}${SENDER_WALLET_ID}${colors.reset}`);
    const senderInitialBalance = await checkWalletBalance(SENDER_WALLET_ID, CURRENCY);
    console.log(`${emoji.money} Initial Balance: ${colors.green}${senderInitialBalance} ${CURRENCY}${colors.reset}`);

    console.log(`\n${emoji.wallet} Receiver Wallet: ${colors.white}${RECEIVER_WALLET_ID}${colors.reset}`);
    const receiverInitialBalance = await checkWalletBalance(RECEIVER_WALLET_ID, CURRENCY);
    console.log(`${emoji.money} Initial Balance: ${colors.green}${receiverInitialBalance} ${CURRENCY}${colors.reset}`);

    // Check if sender has sufficient funds
    console.log(`\n${emoji.info} Transfer Amount: ${colors.yellow}${TRANSFER_AMOUNT} ${CURRENCY}${colors.reset}`);
    if (senderInitialBalance < TRANSFER_AMOUNT) {
      console.log(
        `\n${emoji.error} ${colors.red}Insufficient funds!${colors.reset}`
      );
      console.log(
        `   Sender has: ${colors.red}${senderInitialBalance} ${CURRENCY}${colors.reset}`
      );
      console.log(
        `   Required: ${colors.yellow}${TRANSFER_AMOUNT} ${CURRENCY}${colors.reset}`
      );
      console.log(
        `   Shortfall: ${colors.red}${TRANSFER_AMOUNT - senderInitialBalance} ${CURRENCY}${colors.reset}`
      );
      throw new Error(`Insufficient funds in sender wallet`);
    } else {
      console.log(
        `${emoji.success} ${colors.green}Sender has sufficient balance${colors.reset}`
      );
    }

    // ========== STEP 1: Initiate Transfer ==========
    printSection("Step 1: Initiate Transfer (POST /v1/ewallets/transfer)");
    
    console.log(`${emoji.transfer} Initiating transfer...`);
    console.log(`   From: ${SENDER_WALLET_ID}`);
    console.log(`   To: ${RECEIVER_WALLET_ID}`);
    console.log(`   Amount: ${colors.green}${TRANSFER_AMOUNT} ${CURRENCY}${colors.reset}`);

    const transferResult = await transferFundsBetweenWallets(
      SENDER_WALLET_ID,
      RECEIVER_WALLET_ID,
      TRANSFER_AMOUNT,
      CURRENCY,
      {
        description: "Test wallet-to-wallet transfer",
        test: true,
        timestamp: new Date().toISOString(),
      }
    );

    console.log(`\n${emoji.success} Transfer initiated!`);
    console.log(`   Transfer ID: ${colors.white}${transferResult.transferId}${colors.reset}`);
    console.log(`   Status: ${colors.yellow}${transferResult.status}${colors.reset} (Pending)`);
    console.log(`   Source Transaction: ${transferResult.sourceTransactionId || colors.yellow + "Not yet available" + colors.reset}`);
    console.log(`   Destination Transaction: ${transferResult.destinationTransactionId || colors.yellow + "Not yet available" + colors.reset}`);

    // Verify the transfer is pending
    if (transferResult.status !== "PEN") {
      console.log(
        `\n${emoji.warning} ${colors.yellow}Warning: Expected status "PEN" but got "${transferResult.status}"${colors.reset}`
      );
    }

    // Wait a moment before accepting
    console.log(`\n${emoji.clock} Waiting 2 seconds before accepting transfer...`);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // ========== STEP 2: Accept Transfer ==========
    printSection("Step 2: Accept Transfer (POST /v1/ewallets/transfer/response)");

    console.log(`${emoji.transfer} Accepting transfer...`);
    console.log(`   Transfer ID: ${transferResult.transferId}`);
    console.log(`   Action: ${colors.green}accept${colors.reset}`);

    const acceptResult = await acceptTransfer(
      transferResult.transferId,
      "accept",
      {
        accepted_at: new Date().toISOString(),
        test: true,
      }
    );

    console.log(`\n${emoji.success} Transfer accepted!`);
    console.log(`   Transfer ID: ${colors.white}${acceptResult.transferId}${colors.reset}`);
    console.log(`   Status: ${colors.green}${acceptResult.status}${colors.reset} (Closed)`);
    console.log(`   Amount: ${colors.green}${acceptResult.amount} ${acceptResult.currency}${colors.reset}`);
    console.log(`   Source Wallet: ${acceptResult.sourceEwalletId}`);
    console.log(`   Destination Wallet: ${acceptResult.destinationEwalletId}`);
    console.log(`   Source Transaction: ${acceptResult.sourceTransactionId}`);
    console.log(`   Destination Transaction: ${acceptResult.destinationTransactionId}`);

    // Verify the transfer is closed
    if (acceptResult.status !== "CLO") {
      console.log(
        `\n${emoji.warning} ${colors.yellow}Warning: Expected status "CLO" but got "${acceptResult.status}"${colors.reset}`
      );
    }

    // Wait for balances to update
    console.log(`\n${emoji.clock} Waiting 3 seconds for balances to update...`);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // ========== STEP 3: Verify Final Balances ==========
    printSection("Step 3: Verify Final Wallet Balances");

    console.log(`${emoji.wallet} Sender Wallet: ${colors.white}${SENDER_WALLET_ID}${colors.reset}`);
    const senderFinalBalance = await checkWalletBalance(SENDER_WALLET_ID, CURRENCY);
    console.log(`${emoji.money} Final Balance: ${colors.green}${senderFinalBalance} ${CURRENCY}${colors.reset}`);

    console.log(`\n${emoji.wallet} Receiver Wallet: ${colors.white}${RECEIVER_WALLET_ID}${colors.reset}`);
    const receiverFinalBalance = await checkWalletBalance(RECEIVER_WALLET_ID, CURRENCY);
    console.log(`${emoji.money} Final Balance: ${colors.green}${receiverFinalBalance} ${CURRENCY}${colors.reset}`);

    // ========== STEP 4: Calculate and Display Changes ==========
    printSection("Step 4: Balance Changes");

    const senderChange = senderFinalBalance - senderInitialBalance;
    const receiverChange = receiverFinalBalance - receiverInitialBalance;

    console.log(`${colors.bright}SENDER:${colors.reset}`);
    console.log(`   Initial: ${colors.white}${senderInitialBalance} ${CURRENCY}${colors.reset}`);
    console.log(`   Final: ${colors.white}${senderFinalBalance} ${CURRENCY}${colors.reset}`);
    console.log(
      `   Change: ${senderChange < 0 ? colors.red : colors.green}${senderChange > 0 ? "+" : ""}${senderChange} ${CURRENCY}${colors.reset}`
    );

    console.log(`\n${colors.bright}RECEIVER:${colors.reset}`);
    console.log(`   Initial: ${colors.white}${receiverInitialBalance} ${CURRENCY}${colors.reset}`);
    console.log(`   Final: ${colors.white}${receiverFinalBalance} ${CURRENCY}${colors.reset}`);
    console.log(
      `   Change: ${receiverChange > 0 ? colors.green : colors.red}${receiverChange > 0 ? "+" : ""}${receiverChange} ${CURRENCY}${colors.reset}`
    );

    // ========== STEP 5: Verify Transfer Success ==========
    printSection("Step 5: Verification");

    const expectedSenderChange = -TRANSFER_AMOUNT;
    const expectedReceiverChange = TRANSFER_AMOUNT;

    const senderCorrect = Math.abs(senderChange - expectedSenderChange) < 0.01;
    const receiverCorrect = Math.abs(receiverChange - expectedReceiverChange) < 0.01;

    console.log(`${colors.bright}Expected Changes:${colors.reset}`);
    console.log(
      `   Sender: ${colors.red}${expectedSenderChange} ${CURRENCY}${colors.reset}`
    );
    console.log(
      `   Receiver: ${colors.green}+${expectedReceiverChange} ${CURRENCY}${colors.reset}`
    );

    console.log(`\n${colors.bright}Actual Changes:${colors.reset}`);
    console.log(
      `   Sender: ${senderCorrect ? emoji.success : emoji.error} ${senderChange < 0 ? colors.red : colors.green}${senderChange} ${CURRENCY}${colors.reset}`
    );
    console.log(
      `   Receiver: ${receiverCorrect ? emoji.success : emoji.error} ${receiverChange > 0 ? colors.green : colors.red}+${receiverChange} ${CURRENCY}${colors.reset}`
    );

    // Final result
    if (senderCorrect && receiverCorrect) {
      console.log(
        `\n${emoji.success} ${colors.green}${colors.bright}TRANSFER COMPLETED SUCCESSFULLY!${colors.reset}`
      );
      console.log(`\n${colors.bright}Summary:${colors.reset}`);
      console.log(`   Transfer ID: ${acceptResult.transferId}`);
      console.log(`   Amount: ${TRANSFER_AMOUNT} ${CURRENCY}`);
      console.log(`   Status: ${acceptResult.status} (Closed)`);
      console.log(`   Sender Balance Change: ${senderChange} ${CURRENCY}`);
      console.log(`   Receiver Balance Change: +${receiverChange} ${CURRENCY}`);
      return true;
    } else {
      console.log(
        `\n${emoji.warning} ${colors.yellow}Transfer completed but balance changes don't match expected values${colors.reset}`
      );
      
      if (!senderCorrect) {
        console.log(
          `   ${emoji.error} Sender change mismatch: expected ${expectedSenderChange}, got ${senderChange}`
        );
      }
      if (!receiverCorrect) {
        console.log(
          `   ${emoji.error} Receiver change mismatch: expected ${expectedReceiverChange}, got ${receiverChange}`
        );
      }
      return false;
    }
  } catch (error) {
    console.log(
      `\n${emoji.error} ${colors.red}${colors.bright}TEST FAILED!${colors.reset}`
    );
    console.log(`${emoji.error} Error: ${colors.red}${error.message}${colors.reset}`);
    
    if (error.stack) {
      console.log(`\n${colors.yellow}Stack trace:${colors.reset}`);
      console.log(error.stack);
    }
    
    return false;
  }
}

/**
 * Main entry point
 */
async function main() {
  // Load environment variables from .env file
  const envPath = "../../../supabase/.env";
  try {
    await load({ envPath, export: true });
    console.log(`${emoji.success} Loaded environment variables from ${envPath}`);
  } catch (error) {
    console.log(
      `${emoji.warning} Could not load .env file from ${envPath}, using existing environment variables`
    );
  }

  // Validate required environment variables
  validateEnvironment();

  console.log(`\n${colors.bright}${colors.blue}${"=".repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  Test: Transfer ${TRANSFER_AMOUNT} ${CURRENCY} between Rapyd wallets${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}${"=".repeat(60)}${colors.reset}\n`);

  // Run the test
  const success = await testWalletTransfer();

  // Exit with appropriate code
  Deno.exit(success ? 0 : 1);
}

// Run if this is the main module
if (import.meta.main) {
  main().catch((error) => {
    console.error(
      `${emoji.error} ${colors.red}Fatal error:${colors.reset}`,
      error
    );
    Deno.exit(1);
  });
}

// Export for use in other tests
export { testWalletTransfer };

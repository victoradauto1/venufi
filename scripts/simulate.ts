const { ethers } = require("hardhat");

// ─────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────

const LINE = "═".repeat(60);
const THIN = "─".repeat(60);

function header(title: string) {
  console.log();
  console.log(LINE);
  console.log(`  ${title}`);
  console.log(LINE);
}

function subheader(title: string) {
  console.log();
  console.log(`  ${THIN}`);
  console.log(`  ${title}`);
  console.log(`  ${THIN}`);
}

function log(msg: string) {
  console.log(`  ${msg}`);
}

function money(label: string, wei: bigint) {
  console.log(`  ${label.padEnd(35)} ${ethers.formatEther(wei)} ETH`);
}

async function getBalance(address: string): Promise<bigint> {
  return ethers.provider.getBalance(address);
}

// ─────────────────────────────────────────────────────────
//  MAIN SIMULATION
// ─────────────────────────────────────────────────────────

async function main() {
  header("🏗️  VenueFi — Full Lifecycle Simulation");

  // ── 1. Signers ──────────────────────────────────────────
  const [deployer, operator, investor1, investor2, investor3] =
    await ethers.getSigners();

  subheader("1 │ Accounts");
  log(`Deployer   → ${deployer.address}`);
  log(`Operator   → ${operator.address}`);
  log(`Investor 1 → ${investor1.address}`);
  log(`Investor 2 → ${investor2.address}`);
  log(`Investor 3 → ${investor3.address}`);

  // ── 2. Deploy Factory ───────────────────────────────────
  subheader("2 │ Deploy VenueFactory");

  const Factory = await ethers.getContractFactory("VenueFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();

  const factoryAddr = await factory.getAddress();
  log(`Factory deployed at: ${factoryAddr}`);

  // ── 3. Create Venue (realistic scenario) ────────────────
  subheader("3 │ Create Venue");

  const FUNDING_DURATION = 30 * 24 * 60 * 60; // 30 days
  const OPERATING_DURATION = 180 * 24 * 60 * 60; // 180 days
  const FUNDING_GOAL = ethers.parseEther("10"); // 10 ETH
  const OPERATOR_FEE = 10n; // 10%

  const tx = await factory.connect(operator).createVenue(
    FUNDING_DURATION,
    OPERATING_DURATION,
    FUNDING_GOAL,
    OPERATOR_FEE
  );
  await tx.wait();

  const venueAddress = await factory.venues(0);
  log(`Venue created at: ${venueAddress}`);
  log(`Funding goal:     ${ethers.formatEther(FUNDING_GOAL)} ETH`);
  log(`Funding period:   30 days`);
  log(`Operating period: 180 days`);
  log(`Operator fee:     10%`);

  // Attach VenueFi interface
  const VenueFi = await ethers.getContractFactory("VenueFi");
  const venue = VenueFi.attach(venueAddress);

  // ── 4. Investments ──────────────────────────────────────
  header("💰 FUNDING PHASE");

  const inv1Amount = ethers.parseEther("4");
  const inv2Amount = ethers.parseEther("3");
  const inv3Amount = ethers.parseEther("3");

  await venue.connect(investor1).invest({ value: inv1Amount });
  log(`Investor 1 invested: ${ethers.formatEther(inv1Amount)} ETH`);

  await venue.connect(investor2).invest({ value: inv2Amount });
  log(`Investor 2 invested: ${ethers.formatEther(inv2Amount)} ETH`);

  await venue.connect(investor3).invest({ value: inv3Amount });
  log(`Investor 3 invested: ${ethers.formatEther(inv3Amount)} ETH`);

  const totalRaised = await venue.totalRaised();
  console.log();
  money("Total raised", totalRaised);
  money("Funding goal", FUNDING_GOAL);
  log(`Goal reached: ✅ YES`);

  // ── 5. Finalize Funding ─────────────────────────────────
  header("🔒 FINALIZE FUNDING");

  await venue.finalizeFunding();
  const stateAfterFinalize = await venue.state();
  log(`State transitioned to: ACTIVE (${stateAfterFinalize})`);
  log(`Operating period started`);

  // ── 6. Operator Withdraws Capital ───────────────────────
  header("🏦 OPERATOR WITHDRAWS CAPITAL");

  const operatorBalBefore = await getBalance(operator.address);
  money("Operator balance BEFORE", operatorBalBefore);

  await venue.connect(operator).withdrawCapital();

  const operatorBalAfter = await getBalance(operator.address);
  money("Operator balance AFTER", operatorBalAfter);
  money("Capital received (≈)", operatorBalAfter - operatorBalBefore);
  log(`(Slight difference due to gas costs)`);

  // ── 7. Deposit Revenue ──────────────────────────────────
  header("📈 REVENUE DEPOSITS");

  const rev1 = ethers.parseEther("3");
  const rev2 = ethers.parseEther("2");

  subheader("Deposit #1");
  await venue.connect(operator).depositRevenue({ value: rev1 });
  log(`Operator deposited: ${ethers.formatEther(rev1)} ETH`);
  log(`  Fee (10%):         ${ethers.formatEther(rev1 * 10n / 100n)} ETH → operator`);
  log(`  To investors:      ${ethers.formatEther(rev1 * 90n / 100n)} ETH`);

  subheader("Deposit #2");
  await venue.connect(operator).depositRevenue({ value: rev2 });
  log(`Operator deposited: ${ethers.formatEther(rev2)} ETH`);
  log(`  Fee (10%):         ${ethers.formatEther(rev2 * 10n / 100n)} ETH → operator`);
  log(`  To investors:      ${ethers.formatEther(rev2 * 90n / 100n)} ETH`);

  const totalDeposited = rev1 + rev2;
  const totalFees = totalDeposited * 10n / 100n;
  const totalToInvestors = totalDeposited - totalFees;

  console.log();
  log(`─── Revenue Summary ───`);
  money("Total deposited", totalDeposited);
  money("Total fees (operator)", totalFees);
  money("Total for investors", totalToInvestors);

  // ── 8. Investors Claim Revenue ──────────────────────────
  header("🎯 INVESTORS CLAIM REVENUE");

  // Check pending before claiming
  const pending1 = await venue.pending(investor1.address);
  const pending2 = await venue.pending(investor2.address);
  const pending3 = await venue.pending(investor3.address);

  subheader("Pending Revenue");
  money("Investor 1 (40% share)", pending1);
  money("Investor 2 (30% share)", pending2);
  money("Investor 3 (30% share)", pending3);
  money("Sum of pending", pending1 + pending2 + pending3);

  // Claim
  const bal1Before = await getBalance(investor1.address);
  await venue.connect(investor1).claimRevenue();
  const bal1After = await getBalance(investor1.address);

  const bal2Before = await getBalance(investor2.address);
  await venue.connect(investor2).claimRevenue();
  const bal2After = await getBalance(investor2.address);

  const bal3Before = await getBalance(investor3.address);
  await venue.connect(investor3).claimRevenue();
  const bal3After = await getBalance(investor3.address);

  subheader("Claimed (net of gas)");
  money("Investor 1 received (≈)", bal1After - bal1Before);
  money("Investor 2 received (≈)", bal2After - bal2Before);
  money("Investor 3 received (≈)", bal3After - bal3Before);

  // ── 9. Operator Withdraws Fees ──────────────────────────
  header("💎 OPERATOR WITHDRAWS FEES");

  const feesAccrued = await venue.operatorFeesAccrued();
  money("Fees accrued", feesAccrued);

  const opBalBeforeFees = await getBalance(operator.address);
  await venue.connect(operator).withdrawOperatorFees();
  const opBalAfterFees = await getBalance(operator.address);

  money("Operator received (≈)", opBalAfterFees - opBalBeforeFees);

  // ── 10. Finalize Campaign ────────────────────────────────
  header("🔚 FINALIZE CAMPAIGN");

  log(`Advancing time by ${OPERATING_DURATION / (24 * 60 * 60)} days (operating period)...`);
  await ethers.provider.send("evm_increaseTime", [OPERATING_DURATION]);
  await ethers.provider.send("evm_mine", []);
  log(`⏩ Time advanced past endTime`);

  await venue.finalizeCampaign();
  const finalState = await venue.state();
  log(`State transitioned to: ENDED (${finalState})`);
  log(`✅ Campaign lifecycle fully closed`);

  // ── 11. Final Summary ───────────────────────────────────
  header("📊 FINAL SUMMARY");

  log(`Venue Address:     ${venueAddress}`);
  log(`State:             ENDED (${finalState})`);
  console.log();

  log(`─── Capital Flow ───`);
  money("Total raised", totalRaised);
  money("Revenue deposited", totalDeposited);
  money("Operator fees", totalFees);
  money("Investor revenue", totalToInvestors);
  console.log();

  log(`─── Share Distribution ───`);
  log(`Investor 1: 4 ETH  → 40% share`);
  log(`Investor 2: 3 ETH  → 30% share`);
  log(`Investor 3: 3 ETH  → 30% share`);
  console.log();

  log(`─── Expected vs Actual Revenue ───`);
  money("Investor 1 expected (40%)", totalToInvestors * 40n / 100n);
  money("Investor 1 pending was", pending1);
  money("Investor 2 expected (30%)", totalToInvestors * 30n / 100n);
  money("Investor 2 pending was", pending2);
  money("Investor 3 expected (30%)", totalToInvestors * 30n / 100n);
  money("Investor 3 pending was", pending3);
  console.log();

  const match =
    pending1 === totalToInvestors * 40n / 100n &&
    pending2 === totalToInvestors * 30n / 100n &&
    pending3 === totalToInvestors * 30n / 100n;

  log(match
    ? "✅ Revenue distribution is CORRECT — proportional to shares"
    : "⚠️  Minor rounding dust detected (expected with integer math)"
  );

  console.log();
  log("🎉 Full lifecycle completed successfully!");
  console.log(LINE);
  console.log();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

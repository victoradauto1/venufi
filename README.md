VenueFi

VenueFi is a Real World Asset (RWA) revenue sharing protocol that allows operators to raise capital from investors, deploy it into a real-world venue or business, and distribute revenue proportionally back to investors on-chain.

---

## How It Works

The protocol has three distinct phases:

**FUNDING** — Investors deposit ETH and receive shares proportional to their contribution. The campaign has a deadline and a minimum funding goal. If the goal is not reached by the deadline, investors can reclaim their full investment.

**ACTIVE** — Once the funding goal is reached, the operator finalizes the campaign and gains access to the raised capital. The operator deposits revenue periodically, which is distributed proportionally to all shareholders. This phase has a fixed duration that cannot be shortened by the operator.

**ENDED** — After `endTime`, anyone can finalize the campaign. No new revenue can be deposited. Investors can still claim any accumulated revenue. If the campaign expired without reaching the goal, investors can refund their investment.

---

## Contract Flow
FUNDING ──► ACTIVE ──► ENDED
│                    ▲
└── (goal not met) ──┘
expireFunding()

---

## Key Functions

| Function | Who | When | What |
|---|---|---|---|
| `invest()` | Anyone | FUNDING | Deposit ETH, receive shares |
| `finalizeFunding()` | Anyone | FUNDING, goal reached | Transition to ACTIVE |
| `expireFunding()` | Anyone | FUNDING, deadline passed, goal not reached | Transition to ENDED |
| `refund()` | Investor | ENDED (expired) | Reclaim full investment |
| `withdrawCapital()` | Operator | ACTIVE | Withdraw raised capital to deploy |
| `depositRevenue()` | Operator | ACTIVE | Deposit revenue for distribution |
| `claimRevenue()` | Investor | ACTIVE or ENDED | Claim accumulated revenue |
| `withdrawOperatorFees()` | Operator | ACTIVE or ENDED | Withdraw accrued fee share |
| `finalizeCampaign()` | Anyone | ACTIVE, after endTime | Transition to ENDED |

---

## Revenue Distribution

Revenue is distributed using an accumulator pattern inspired by MasterChef:
accRevenuePerToken += (investorRevenue * PRECISION) / totalSupply
pending(user) = (balance[user] * accRevenuePerToken) / PRECISION - rewardDebt[user]

This allows O(1) distribution regardless of the number of investors. When a user invests, their `rewardDebt` is synchronized to prevent capturing revenue deposited before their entry. The operator fee is deducted at the moment of deposit — not at withdrawal — to prevent the operator from recalculating fees on already-processed balances.

---

## Design Decisions and Trade-offs

**Trusted Operator Model** — This protocol is trust-based, not trustless. The operator can withdraw all raised capital and controls when revenue is deposited. This is a deliberate design choice — VenueFi is designed for relationships where the operator is a known, accountable entity with legal obligations to investors. Built-in mitigations: `endTime` enforces a minimum operating period the operator cannot shorten, and after `endTime` anyone can call `finalizeCampaign()` to prevent the contract from being stuck if the operator disappears.

**claimRevenue after ENDED** — Investors can claim in both ACTIVE and ENDED states. Blocking claims after finalization would permanently lock earned funds in the contract.

**Reentrancy** — All ETH transfers follow the CEI pattern (state updated before external call). `nonReentrant` from OpenZeppelin is applied as defense-in-depth.

**Fee validation** — `operatorFeePercentage` is capped at 100 at construction time and cannot be changed after deployment.

---

## Security Considerations

| Risk | Severity | Mitigation |
|---|---|---|
| Operator runs away with capital | High | Trust-based — out of scope for on-chain enforcement |
| Operator never deposits revenue | High | Trust-based — out of scope for on-chain enforcement |
| Investor captures past revenue | Medium | rewardDebt synchronized on every invest |
| Reentrancy | Low | CEI pattern + nonReentrant |
| Fee manipulation | Low | Fee capped at 100% at construction |
| Integer overflow/underflow | Low | Solidity 0.8.x built-in checks |

---

## Deployment Parameters

```solidity
constructor(
    uint256 _fundingDeadline,      // e.g. 30 days = 2592000
    uint256 _operatingDuration,    // e.g. 1 year = 31536000
    uint256 _fundingGoal,          // e.g. 10 ETH = 10e18
    address _operator,             // venue owner address
    uint256 _operatorFeePercentage // e.g. 10 = 10%
)
```

---

## Test Coverage

100% statements, 100% functions, 100% lines. Branch gap on defensive underflow guard in `pending()` — unreachable through normal contract flow, covered via test harness.

---

## Stack

- Solidity 0.8.20
- Hardhat
- OpenZeppelin ReentrancyGuard
- Ethers.js v6
- Chai + Hardhat Network Helpers
# VenueFi

VenueFi is a Real World Asset (RWA) revenue sharing protocol that allows operators to raise capital from investors, deploy it into a real-world venue or business, and distribute revenue proportionally back to investors on-chain.

---

## How It Works

The protocol has three distinct phases:

**FUNDING** — Investors deposit ETH and receive shares proportional to their contribution. The campaign has a deadline and a minimum funding goal. If the goal is not reached by the deadline, anyone can call `expireFunding()`, after which investors can reclaim their full investment.

**ACTIVE** — Once the funding goal is reached, anyone can call `finalizeFunding()`, enabling the operator to access the raised capital. The operator deposits revenue periodically, which is distributed proportionally to all shareholders. This phase has a fixed duration that cannot be shortened by the operator. Revenue deposits are only allowed before `endTime`.

**ENDED** — After `endTime`, anyone can call `finalizeCampaign()`. No new revenue can be deposited. Investors can still claim any accumulated revenue. If the campaign expired without reaching the goal, investors can refund their investment.

---

## Contract Flow

```
FUNDING ──► ACTIVE ──► ENDED
│                    ▲
└── (goal not met) ──┘
        expireFunding()
```

---

## Share Model

Shares are internal accounting units and are **not transferable**.

- Shares are denominated in wei and directly mapped to the amount of ETH deposited (1 wei = 1 share)  
- No ERC20 token is minted  
- There is no secondary market or transfer mechanism  

Investors can only:
- Hold shares  
- Claim revenue  
- Refund (if the campaign fails)  

---

## Key Functions

| Function | Who | When | What |
|---|---|---|---|
| `invest()` | Anyone | FUNDING | Deposit ETH and receive shares |
| `finalizeFunding()` | Anyone | FUNDING, goal reached | Transition to ACTIVE |
| `expireFunding()` | Anyone | FUNDING, deadline passed, goal not reached | Transition to ENDED |
| `refund()` | Investor | ENDED (expired) | Reclaim full investment |
| `withdrawCapital()` | Operator | ACTIVE | Withdraw raised capital |
| `depositRevenue()` | Operator | ACTIVE (before endTime) | Deposit revenue for distribution |
| `claimRevenue()` | Investor | ACTIVE or ENDED | Claim accumulated revenue |
| `withdrawOperatorFees()` | Operator | ACTIVE or ENDED | Withdraw accrued fees |
| `finalizeCampaign()` | Anyone | ACTIVE, after endTime | Transition to ENDED |

---

## Revenue Distribution

Revenue is distributed using an accumulator pattern inspired by MasterChef:

```solidity
accRevenuePerToken += (investorRevenue * PRECISION) / totalSupply;

pending(user) =
    (balance[user] * accRevenuePerToken) / PRECISION
    - rewardDebt[user];
```

This enables **O(1) distribution**, regardless of the number of investors.

Key mechanics:
- `rewardDebt` is updated on every user interaction to prevent capturing past revenue  
- Operator fees are deducted at deposit time (not at withdrawal)  
- Integer division rounding may leave minimal residual dust in the contract  

---

## State Machine Guarantees

- FUNDING → ACTIVE only if `fundingGoal` is reached  
- FUNDING → ENDED only if deadline has passed and goal was not reached  
- ACTIVE → ENDED only after `endTime`  
- No backward transitions are possible  

---

## Design Decisions and Trade-offs

**Trusted Operator Model**  
This protocol is intentionally trust-based.

The operator:
- Can withdraw all raised capital  
- Controls when revenue is deposited  

This design assumes a real-world, legally accountable operator.

Mitigations:
- `endTime` enforces a minimum operating period  
- Anyone can call `finalizeCampaign()` to prevent the contract from being stuck  

---

**claimRevenue After ENDED**  
Revenue claims remain available after finalization.  
Blocking claims would permanently lock earned funds.

---

**Non-transferable Shares**  
Shares are not tokenized or transferable.  
This simplifies accounting and avoids secondary market complexity.

---

**Reentrancy Protection**  
All external calls follow the Checks-Effects-Interactions (CEI) pattern.  
`nonReentrant` is applied as defense-in-depth.

---

**Fee Validation**  
`operatorFeePercentage` is capped at 100% at deployment and cannot be changed afterward.

---

## Security Considerations

| Risk | Severity | Mitigation |
|---|---|---|
| Operator runs away with capital | High | Trust-based — off-chain enforcement required |
| Operator withdraws capital without generating revenue | High | Trust-based — no on-chain enforcement |
| Operator never deposits revenue | High | Trust-based — no on-chain enforcement |
| Investor captures past revenue | Medium | rewardDebt synchronization |
| Reentrancy | Low | CEI pattern + nonReentrant |
| Fee manipulation | Low | Fee capped at deployment |
| Integer rounding dust | Low | Minimal residual value may remain |
| Integer overflow/underflow | Low | Solidity 0.8.x protections |

---

## Deployment Parameters

```solidity
constructor(
    uint256 _fundingDeadline,
    uint256 _operatingDuration,
    uint256 _fundingGoal,
    address _operator,
    uint256 _operatorFeePercentage
)
```

---

## Test Coverage

- 100% statements  
- 100% functions  
- 100% lines  

Known exception:
- Branch gap in `pending()` underflow guard (defensive path, unreachable in normal flow, covered via test harness)

---

## Stack

- Solidity 0.8.20  
- Hardhat  
- OpenZeppelin (ReentrancyGuard)  
- Ethers.js v6  
- Chai + Hardhat Network Helpers  

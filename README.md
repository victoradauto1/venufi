# VenueFi

VenueFi is a Real World Asset (RWA) revenue sharing protocol that allows operators to raise capital from investors, deploy it into a real-world venue or business, and distribute revenue proportionally back to investors on-chain.

---

## Repository Structure

```
venuefi/
├── blockchain/   ← Smart contracts, tests, scripts, and Hardhat configuration
└── frontend/     ← Web application (coming soon)
```

### [`blockchain/`](./blockchain/)

Contains the Solidity contracts, Hardhat configuration, test suite, deployment scripts, and protocol documentation.

- **Contracts**: `VenueFi.sol`, `VenueFactory.sol`
- **Tests**: 100% statement, function, and line coverage
- **Scripts**: Full lifecycle simulation
- **Docs**: Protocol documentation and simulation screenshots

### [`frontend/`](./frontend/)

Reserved for the upcoming web application.

---

## Getting Started

```bash
# Smart contracts
cd blockchain
npm install
npx hardhat compile
npx hardhat test
```

---

## License

[MIT](./LICENSE)

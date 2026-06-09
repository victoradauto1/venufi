# VenueFi — Frontend

> Portfolio-grade Web3 frontend built with Next.js, TypeScript, wagmi, viem, and RainbowKit for the VenueFi Real World Asset (RWA) revenue-sharing protocol.

VenueFi is a proof-of-concept RWA protocol that enables real-world venue operators to raise capital through on-chain funding campaigns and distribute revenue proportionally to investors.

This frontend provides an interface for interacting with deployed VenueFi smart contracts on Ethereum Sepolia, including interaction with deployed VenueFi campaigns, investments, revenue deposits, revenue claims, and lifecycle management.

---

## Architecture Overview

### Technology Stack

* Next.js App Router
* TypeScript
* React
* Tailwind CSS
* RainbowKit
* wagmi
* viem
* TanStack React Query

### Network

* Ethereum Sepolia Testnet

### Provider Stack

```text
WagmiProvider
└── QueryClientProvider
    └── RainbowKitProvider
```

### Design Principles

* Server-first architecture using App Router
* Type-safe smart contract interactions
* Direct on-chain reads and writes
* Wallet-aware user experience
* Separation between presentation and blockchain interaction layers

---

## Core Features

### Venue Dashboard

* Real-time venue state (FUNDING / ACTIVE / ENDED)
* Funding goal tracking
* Capital raised tracking
* Funding progress visualization
* On-chain data reads

### Investment System

* ETH investments
* Share-based ownership accounting
* Transaction lifecycle feedback
* Wallet connection and validation
* Contract write interactions

### Revenue Distribution

* Revenue deposits by operators
* Revenue claims by investors
* Accumulator-based accounting model
* On-chain revenue calculations

### Lifecycle Management

* FUNDING → ACTIVE → ENDED transitions
* Funding expiration support
* Refund support for failed campaigns
* Campaign finalization support

---

## Smart Contract Integration

### VenueFactory

Responsible for:

* Creating VenueFi campaigns
* Tracking deployed venues
* Tracking venues by operator

### VenueFi

Responsible for:

* Funding lifecycle
* Revenue distribution
* Share accounting
* Fee accounting
* Claims
* Refunds
* Capital withdrawals

Contract ABIs are imported directly from Hardhat-generated artifacts.

---

## Pages and Routes

### Top-Level Routes

| Route      | Description              |
| ---------- | ------------------------ |
| `/`        | Landing page             |
| `/invest`  | Investment entry page    |
| `/revenue` | Revenue interaction page |
| `/admin`   | Administrative controls  |

### Venue-Specific Routes

| Route                      | Description              |
| -------------------------- | ------------------------ |
| `/venue/[address]`         | Venue overview           |
| `/venue/[address]/invest`  | Venue investment page    |
| `/venue/[address]/admin`   | Venue administration     |
| `/venue/[address]/revenue` | Venue revenue management |

---

## Installation

### Prerequisites

* Node.js 18+
* npm
* MetaMask or compatible wallet

### Clone Repository

```bash
git clone https://github.com/victoradauto1/venufi.git
cd venuefi/frontend
```

### Install Dependencies

```bash
npm install
```

### Compile Smart Contracts

```bash
cd ../blockchain
npx hardhat compile
cd ../frontend
```

---

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

A valid WalletConnect Cloud Project ID is recommended.

---

## Running Locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Example:

```text
http://localhost:3000/venue/<contract-address>/invest
```

---

## Production Build

```bash
npm run build
npm start
```

---

## Deployment

The application can be deployed to Vercel or any platform that supports Next.js.

### Vercel

1. Import repository
2. Set root directory to:

```text
frontend
```

3. Configure:

```text
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
```

4. Deploy

---

## Source Structure

```text
src/app
├── abi
│   ├── VenueFactory.json
│   └── VenueFi.json
├── admin
│   └── page.tsx
├── components
│   ├── ConnectButton.tsx
│   ├── Footer.tsx
│   └── Stat.tsx
├── invest
│   └── page.tsx
├── revenue
│   └── page.tsx
├── venue
│   └── [address]
│       ├── VenueOverview.tsx
│       ├── admin
│       ├── invest
│       └── revenue
├── layout.tsx
├── page.tsx
└── providers.tsx
```

---

## Project Status

VenueFi is currently a proof-of-concept implementation deployed and tested on Ethereum Sepolia.

### Implemented

* Funding lifecycle
* Revenue-sharing mechanism
* Revenue claims
* Operator fee accounting
* Wallet integration
* Smart contract interaction layer
* Responsive user interface

### Planned Improvements

* Venue creation UI
* Revenue history indexing
* Enhanced operator dashboard
* Multi-chain support
* Production deployment enhancements

---

## Purpose

This project was built to demonstrate:

* Web3 frontend architecture
* Smart contract integration
* Wallet connectivity
* Type-safe Ethereum interactions
* Revenue-sharing protocol design
* Full-stack blockchain development

---

## License

MIT License

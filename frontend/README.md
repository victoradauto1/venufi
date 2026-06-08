# VenueFi — Frontend

> Next.js frontend for the VenueFi Real World Asset (RWA) revenue-sharing proof-of-concept protocol on Ethereum.

VenueFi is a proof-of-concept RWA revenue-sharing protocol that enables real-world venue operators to raise capital through on-chain funding campaigns and distribute business revenue proportionally to investors.

This frontend provides an interface for interacting with deployed VenueFi smart contracts on Ethereum Sepolia, including wallet connection, venue exploration, investment, revenue deposits, and revenue claims.

---

## Features

### Current Functionality

#### Venue Overview

* View venue state (FUNDING, ACTIVE, ENDED)
* View funding goal
* View capital raised
* View funding progress
* Read all data directly from deployed smart contracts

#### Investment Flow

* Connect wallet
* Invest ETH into a venue
* View ownership share
* Transaction lifecycle feedback
* Validation and wallet-aware UI

#### Revenue Distribution

* Operator can deposit revenue
* Revenue is distributed proportionally to investors
* Investors can claim pending revenue
* Revenue calculations performed on-chain

#### Protocol Lifecycle

* FUNDING → ACTIVE → ENDED state transitions
* Funding expiration support
* Refund support when funding goals are not reached

#### User Experience

* Responsive layout
* Loading skeletons
* Transaction feedback
* Wallet connection through RainbowKit
* Ethereum Sepolia support

---

## Tech Stack

| Layer              | Technology           |
| ------------------ | -------------------- |
| Framework          | Next.js              |
| Language           | TypeScript           |
| UI                 | React                |
| Styling            | Tailwind CSS         |
| Wallet Integration | RainbowKit           |
| Web3 Integration   | wagmi                |
| Ethereum Client    | viem                 |
| Data Fetching      | TanStack React Query |
| Smart Contracts    | Solidity             |
| Network            | Ethereum Sepolia     |

---

## Architecture

The application follows a server-first architecture using the Next.js App Router.

### Server Components

Responsible for:

* Route handling
* Layout rendering
* Static content
* Parameter extraction

### Client Components

Responsible for:

* Wallet interaction
* Smart contract reads
* Smart contract writes
* Transaction state management

### Provider Stack

WagmiProvider
└── QueryClientProvider
    └── RainbowKitProvider

### Contract Integration

The frontend interacts directly with:

* VenueFactory
* VenueFi

Contract ABIs are imported from compiled Hardhat artifacts.

---

## Protocol Overview

VenueFi is designed as a revenue-sharing protocol for Real World Assets.

### 1. Venue Creation

An operator creates a new venue by defining:

* Funding goal
* Funding duration
* Operating duration
* Operator fee percentage

### 2. Funding Phase

Investors contribute ETH to the venue.

In return, they receive proportional ownership shares tracked on-chain.

### 3. Activation

When the funding goal is reached:

* Funding is finalized
* Venue enters ACTIVE state

### 4. Capital Deployment

The operator withdraws the raised capital and deploys it into the real-world business.

### 5. Revenue Deposits

As the business generates revenue:

* The operator deposits revenue on-chain
* Operator fees are automatically separated
* Remaining revenue is allocated proportionally to investors

### 6. Revenue Claims

Investors claim accumulated revenue at any time during or after the active period.

### 7. Campaign Finalization

After the operating period ends:

* Campaign is finalized
* Venue enters ENDED state

### Failed Campaigns

If the funding goal is not reached before the deadline:

* Funding expires
* Investors can withdraw their funds through refunds

---

## Smart Contracts

### VenueFactory

Responsible for:

* Creating VenueFi instances
* Tracking created venues
* Tracking venues by operator

### VenueFi

Responsible for:

* Funding management
* Revenue distribution
* Share accounting
* Fee accounting
* Claims
* Refunds
* Capital withdrawals

---

## Pages and Routes

### Landing Page

| Route | Description       |
| ----- | ----------------- |
| /     | Protocol overview |

### Venue Routes

| Route                    | Description          |
| ------------------------ | -------------------- |
| /venue/[address]         | Venue overview       |
| /venue/[address]/invest  | Investment interface |
| /venue/[address]/admin   | Operator controls    |
| /venue/[address]/revenue | Revenue claims       |

---

## Installation

### Prerequisites

* Node.js 18+
* npm
* MetaMask or compatible wallet

### Clone Repository

```bash
git clone https://github.com/victoradauto1/venufi.git
cd venufi/frontend
```

### Install Dependencies

```bash
npm install
```

### Compile Smart Contracts

```bash
cd ../blockchain
npx hardhat compile
```

### Return to Frontend

```bash
cd ../frontend
```

---

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

A valid WalletConnect Cloud Project ID is recommended for production deployments.

---

## Running Locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Example venue route:

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

### Vercel Deployment

1. Import the GitHub repository
2. Set Root Directory to:

```text
frontend
```

3. Configure environment variables:

```text
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
```

4. Deploy

---

## Folder Structure

```text
frontend/
├── public/
├── src/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── types/
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

---

## Project Status

VenueFi is currently a proof-of-concept implementation deployed and tested on the Ethereum Sepolia testnet.

### Implemented

* Venue funding lifecycle
* Revenue distribution mechanism
* Revenue claim system
* Operator fee accounting
* Wallet integration
* Smart contract interaction
* Responsive frontend

### Planned Improvements

* Venue creation interface
* Complete operator dashboard
* Revenue history indexing
* Production deployment configuration
* Multi-chain support

---

## Purpose

This project was built to demonstrate:

* Solidity development
* Smart contract architecture
* Real World Asset (RWA) protocols
* Revenue-sharing mechanisms
* Web3 frontend integration
* Full-stack blockchain development

---

## License

MIT License

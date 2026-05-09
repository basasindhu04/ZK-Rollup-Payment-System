# ZK Rollup Payment System

A full-stack, ZK-rollup-inspired payment system demonstrating Layer 2 scaling concepts. Built with **Solidity**, **Node.js/TypeScript**, **PostgreSQL**, and **Flutter**.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User / Frontend                       │
│                    Flutter Web App (:8080)                   │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP REST
┌────────────────────────────▼────────────────────────────────┐
│                     Backend (Node.js :4000)                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────────────┐ │
│  │  REST API │   │ Relayer  │   │       Indexer            │ │
│  │ (Express) │   │(15s tick)│   │  (on-chain event watch)  │ │
│  └────┬──────┘   └────┬─────┘   └────────────┬─────────────┘ │
└───────┼───────────────┼─────────────────────┼────────────────┘
        │               │                     │
┌───────▼───────┐  ┌────▼──────────────────────▼────────────────┐
│  PostgreSQL   │  │         Hardhat (Local Ethereum :8545)       │
│   (:5432)     │  │    ZKRollupPayments.sol + StubZKVerifier.sol │
└───────────────┘  └──────────────────────────────────────────────┘
```

### Components

| Component | Description |
|-----------|-------------|
| **Smart Contracts** | `ZKRollupPayments.sol` holds deposits, verifies proofs, commits batches. `StubZKVerifier.sol` always returns `true` to simulate ZK verification. |
| **Relayer** | Polls `payment_intents` table every 15s, computes `batchHash` + `newStateRoot`, calls `commitBatch()` on-chain. |
| **Indexer** | Listens to `Deposited`, `BatchCommitted`, and `Withdrawn` events and persists them to PostgreSQL. |
| **REST API** | Express.js API serving frontend requests; performs live on-chain balance checks. |
| **Flutter App** | 4-screen web wallet: Dashboard, Send, History, Batch Explorer. |

---

## Prerequisites

- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
- [Node.js](https://nodejs.org/) v20+ (for running validate.js locally)

---

## Quick Start

### 1. Clone and configure

```bash
git clone <repo-url>
cd zk-rollup-payments
cp .env.example .env
```

The `.env.example` ships with default Hardhat Account #0 as the relayer and Account #1 as User A. These are fine for local development.

### 2. Start the system

```bash
docker-compose up --build
```

Services start in this order:
1. `hardhat` — local blockchain node
2. `postgres` — database
3. `deployer` — compiles contracts, deploys them, writes `deployments/addresses.json`
4. `backend` — runs migrations, starts API + relayer + indexer
5. `flutter` — builds web app, serves on nginx

### 3. Access the application

| Service | URL |
|---------|-----|
| Flutter Web App | http://localhost:8080 |
| Backend API | http://localhost:4000 |
| Hardhat RPC | http://localhost:8545 |
| PostgreSQL | localhost:5432 |

### 4. Run validation

```bash
# Install dependencies first
npm install
cp .env.example .env  # ensure .env has keys

node scripts/validate.js
```

This produces `validation_report.json` in the project root.

---

## API Reference

### `POST /intents`
Submit a payment intent. Performs live on-chain balance check.

```json
// Request
{ "fromAddress": "0x...", "toAddress": "0x...", "amountWei": "100000000000000000" }

// Response 201
{ "intentId": "uuid", "status": "pending", ... }

// Response 400 (insufficient balance)
{ "error": "Insufficient on-chain deposit" }
```

### `GET /intents?address=0x...&status=pending`
List payment intents with optional filters.

### `GET /state`
Returns current rollup state root and batch count.

### `GET /deposits/:address`
Live balance lookup for an address.

### `GET /batches`
All committed batches.

### `GET /batches/:batchIndex`
Single batch details + included transactions.

---

## Smart Contracts

### `ZKRollupPayments.sol`

| Function | Description |
|----------|-------------|
| `deposit()` | Accept ETH, update user balance |
| `commitBatch(...)` | Relayer-only; verifies proof, updates state root |
| `withdraw(amount)` | User withdraws their ETH |
| `addRelayer(addr)` | Owner adds relayer |
| `removeRelayer(addr)` | Owner removes relayer |
| `isRelayer(addr)` | Check if address is relayer |

### Events

| Event | Fields |
|-------|--------|
| `Deposited` | `user`, `amount`, `newBalance` |
| `BatchCommitted` | `batchIndex`, `newStateRoot`, `batchHash`, `txCount`, `relayer` |
| `Withdrawn` | `user`, `amount` |

---

## Database Schema

```sql
payment_intents  -- off-chain payment intents
batches          -- on-chain committed batches (indexed from events)
deposits         -- on-chain deposit records (indexed from events)
```

---

## Flutter App Screens

| Route | Screen | Description |
|-------|--------|-------------|
| `/` | Dashboard | View balance & rollup state |
| `/send` | Send Payment | Submit new payment intent |
| `/history` | Transaction History | Filter & view intents |
| `/batches` | Batch Explorer | Browse committed batches |

---

## Development

### Compile & test contracts

```bash
npm install
npx hardhat compile
npx hardhat test
```

### Run backend locally

```bash
cd backend
npm install
npm run build
# Set env vars first
npm start
```

### Run Flutter locally

```bash
cd flutter_app
flutter pub get
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:4000
```

---

## Environment Variables

See `.env.example` for all required variables. Key ones:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `RPC_URL` | Ethereum JSON-RPC endpoint |
| `RELAYER_PRIVATE_KEY` | Private key of the relayer wallet |
| `USER_A_PRIVATE_KEY` | Test user private key (for validate.js) |
| `API_PORT` | Backend server port (default: 4000) |

---

## Architecture Notes

### Why a Stub Verifier?
Real ZK circuit development (Circom/ZoKrates) is complex and out of scope. The `StubZKVerifier` always returns `true`, allowing us to focus on the system architecture and data flow.

### State Root Simplification
`newStateRoot = keccak256(currentStateRoot || batchHash)` is a simplified placeholder. A production system would build a full Merkle tree over all account states.

### Indexer vs Direct Contract Queries
The indexer pattern (event-driven DB writes) enables fast SQL queries for the frontend, avoiding slow block-by-block chain scans. This is standard in production dApps (The Graph protocol uses this model).

### Relayer Centralization
This system has a single trusted relayer — a known centralization tradeoff. Production L2s use decentralized sequencer sets or proof-of-stake systems.

---

## License

MIT

# Autonomous Negotiation Protocol (ANP)

**Agents negotiate price autonomously. x402 fires on convergence. ERC-8004 informs strategy.**

Two AI agents — a Buyer and a Seller — negotiate the price of a digital service on-chain via iterative offers on Avalanche Fuji C-Chain. When bids converge, a smart contract triggers atomic USDC payment via x402. ERC-8004 reputation determines how each agent negotiates — high-reputation sellers hold higher floors, buyers with strong payment history get better deals.

Built for **Team1 India's Speedrun: Agentic Payments** hackathon.

---

## How It Works

1. **Buyer opens a session** — defines service, budget cap, and max negotiation rounds on-chain
2. **Seller discovers the session** — polls the contract, reviews buyer reputation
3. **Negotiation rounds** — each round:
   - Seller submits an ask (decreasing)
   - Buyer submits a bid (increasing)
   - Claude decides each move using reputation-aware strategy prompts
4. **Convergence** — when `bid >= ask`, the midpoint is settled as `agreedPrice`
5. **x402 payment** — buyer pays seller's wallet directly via on-chain transfer with HTTP 402 flow
6. **Feedback** — both agents submit on-chain reputation ratings after deal completes

### Convergence Example

| Round | Seller Ask (USDC) | Buyer Bid (USDC) | Gap |
|-------|------------------|-----------------|-----|
| 0     | 100.00           | 20.00           | 80% |
| 1     | 85.00            | 40.00           | 53% |
| 2     | 73.00            | 58.00           | 21% |
| 3     | 65.00            | 65.00           | 0% → **DEAL** |

---

## Tech Stack

- **Blockchain**: Avalanche Fuji Testnet (C-Chain, chainId 43113)
- **Smart Contracts**: Solidity 0.8.20 + Hardhat
- **Agents**: Python 3.11 + web3.py + Anthropic Python SDK
- **AI Strategy**: Claude claude-sonnet-4-6 via Anthropic API
- **Payment Protocol**: x402 (HTTP 402 based, manual implementation)
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS + ethers.js
- **Contract Testing**: Hardhat + chai

---

## Deployed Contracts

- AgentRegistry: [Fuji Snowtrace link] (fill after deploy)
- NegotiationEngine: [Fuji Snowtrace link] (fill after deploy)

---

## How to Run

```bash
# Install JS deps
npm install

# Install Python deps
pip install web3 anthropic python-dotenv requests flask

# Configure
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, BUYER_PRIVATE_KEY, SELLER_PRIVATE_KEY, DEPLOYER_PRIVATE_KEY

# Deploy contracts
npx hardhat run scripts/deploy.js --network fuji
# Copy AGENT_REGISTRY_ADDRESS and NEGOTIATION_ENGINE_ADDRESS to .env

# Seed agents on-chain
python scripts/seed_agents.py

# Run demo
./demo.sh
```

---

## How x402 Is Used

The x402 protocol (HTTP 402 Payment Required) is implemented manually:

1. Buyer requests seller's `/service` endpoint
2. Seller returns **402** with payment address and chain info
3. Buyer sends on-chain AVAX transfer (simulating USDC for demo)
4. Buyer retries with `X-Payment-Tx` header containing the tx hash
5. Seller verifies the transaction on-chain, returns the service content

No platform middleware. Buyer pays seller's wallet directly.

---

## How ERC-8004 Is Used

- **Identity registry** — both agents register with name, niche, and wallet
- **Reputation scores** — start at 5.0/10, updated via weighted average after each deal
- **Strategy influence** — reputation feeds directly into Claude's prompt:
  - High-reputation sellers (>8.0) hold higher floors
  - Buyers with strong payment history get more generous seller concessions
  - Low-reputation agents (<2.0) are ignored
- **Feedback loop** — `submitFeedback()` writes on-chain ratings after each deal

---

## Project Structure

```
├── contracts/
│   ├── AgentRegistry.sol        # ERC-8004 identity & reputation
│   ├── NegotiationEngine.sol    # Negotiation state machine
│   └── test/
│       └── NegotiationEngine.test.js
├── agents/
│   ├── contract_client.py       # web3.py contract wrapper
│   ├── strategy.py              # Claude AI strategy prompts
│   ├── x402_client.py           # x402 payment protocol
│   ├── buyer_agent.py           # Autonomous buyer agent
│   └── seller_agent.py          # Autonomous seller agent
├── scripts/
│   ├── deploy.js                # Contract deployment
│   └── seed_agents.py           # On-chain agent registration
├── frontend/                    # Next.js monitoring UI
├── demo.sh                      # One-command demo launcher
├── hardhat.config.js
├── .env / .env.example
└── README.md
```

---

## What This Demonstrates

- **x402**: Full protocol flow — HTTP 402 → on-chain payment → service delivery, live on Fuji
- **ERC-8004**: On-chain identity and reputation driving AI strategy
- **Avalanche C-Chain**: Every offer is an on-chain tx. Settlement is on-chain. Snowtrace links for everything
- **Autonomous**: Zero human decisions after `python buyer_agent.py`. The entire economy runs itself

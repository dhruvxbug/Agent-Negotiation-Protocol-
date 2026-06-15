# Master Build Prompt: Autonomous Negotiation Protocol (ANP)

## What You Are Building

You are building the **Autonomous Negotiation Protocol** — a system where a Buyer AI agent and a Seller AI agent negotiate the price of a digital service autonomously using iterative on-chain offers. When their bids converge, a smart contract triggers atomic USDC payment via x402. ERC-8004 reputation on Avalanche Fuji C-Chain determines how each agent negotiates — high reputation sellers hold higher floors, buyers with strong payment history get better deals. No human sets prices. No human approves payments. The agents do everything.

This is a hackathon submission for Team1 India's Speedrun: Agentic Payments.

---

## Tech Stack

- **Blockchain**: Avalanche Fuji Testnet (C-Chain, chainId 43113)
- **Smart Contracts**: Solidity 0.8.20 + Hardhat
- **Agents**: Python 3.11 + web3.py + Anthropic Python SDK
- **AI Strategy**: Claude claude-sonnet-4-6 via Anthropic API
- **Payment Protocol**: x402 (HTTP 402 based, manual implementation in Python)
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS + ethers.js
- **Contract Testing**: Hardhat + chai

---

## Environment Variables

Create `.env` in root with:

```
# Anthropic
ANTHROPIC_API_KEY=your_key_here

# Blockchain
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
BUYER_PRIVATE_KEY=your_buyer_wallet_private_key
SELLER_PRIVATE_KEY=your_seller_wallet_private_key
DEPLOYER_PRIVATE_KEY=your_deployer_private_key

# Deployed contract addresses (fill after deploy)
NEGOTIATION_ENGINE_ADDRESS=
AGENT_REGISTRY_ADDRESS=

# Agent config
BUYER_BUDGET_CAP=100        # max USDC buyer will spend
SELLER_FLOOR_PRICE=40       # min USDC seller will accept
MAX_ROUNDS=5
POLL_INTERVAL_SECONDS=8
```

Create `.env.example` copying the above with empty values.

---

## Build Order

Build in this exact sequence. Complete each phase before moving to the next.

---

## Phase 1: Project Scaffold

### 1.1 — Initialize project

```bash
mkdir autonomous-negotiation-protocol
cd autonomous-negotiation-protocol
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox dotenv
npx hardhat init  # choose "Create a JavaScript project"
```

### 1.2 — Install Python dependencies

```bash
pip install web3 anthropic python-dotenv requests flask
```

### 1.3 — Create directory structure

```
autonomous-negotiation-protocol/
├── contracts/
│   ├── AgentRegistry.sol
│   ├── NegotiationEngine.sol
│   └── test/
├── agents/
│   ├── buyer_agent.py
│   ├── seller_agent.py
│   ├── strategy.py
│   ├── x402_client.py
│   └── contract_client.py
├── scripts/
│   ├── deploy.js
│   └── seed_agents.py
├── frontend/
│   └── (Next.js app created in Phase 4)
├── hardhat.config.js
├── .env
└── .env.example
```

### 1.4 — hardhat.config.js

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    fuji: {
      url: process.env.FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY].filter(Boolean),
    },
    hardhat: {
      chainId: 31337,
    }
  }
};
```

---

## Phase 2: Smart Contracts

### 2.1 — contracts/AgentRegistry.sol

This contract implements ERC-8004 inspired identity and reputation for agents. Build it with the following exact interface:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AgentRegistry {

    // ── Structs ──────────────────────────────────────────────────────────

    struct Agent {
        address wallet;
        string name;
        string serviceNiche;       // e.g. "data-analysis", "content", "computation"
        uint256 reputationScore;   // 0 to 10000 (basis points, 10000 = perfect 10/10)
        uint256 totalRatings;
        uint256 dealsCompleted;
        uint256 dealsAbandoned;
        uint256 totalEarnedWei;    // total USDC received (in wei equivalent)
        uint256 registeredAt;
        bool isActive;
    }

    struct DealFeedback {
        bytes32 sessionId;
        address rater;
        address rated;
        uint8 score;               // 1 to 5
        bool deliveredOnTime;
        uint256 timestamp;
    }

    // ── Storage ──────────────────────────────────────────────────────────

    mapping(address => Agent) public agents;
    mapping(address => bool) public isRegistered;
    mapping(bytes32 => DealFeedback[]) public sessionFeedback;
    address[] public agentIndex;

    // ── Events ───────────────────────────────────────────────────────────

    event AgentRegistered(address indexed wallet, string name, string niche);
    event FeedbackSubmitted(bytes32 indexed sessionId, address indexed rated, uint8 score);
    event ReputationUpdated(address indexed agent, uint256 oldScore, uint256 newScore);
    event DealStatsUpdated(address indexed agent, uint256 dealsCompleted, uint256 totalEarned);

    // ── Modifiers ────────────────────────────────────────────────────────

    modifier onlyRegistered() {
        require(isRegistered[msg.sender], "Agent not registered");
        _;
    }

    // ── Functions ────────────────────────────────────────────────────────

    function registerAgent(string calldata name, string calldata niche) external {
        require(!isRegistered[msg.sender], "Already registered");
        require(bytes(name).length > 0 && bytes(name).length <= 64, "Invalid name");
        require(bytes(niche).length > 0 && bytes(niche).length <= 32, "Invalid niche");

        agents[msg.sender] = Agent({
            wallet: msg.sender,
            name: name,
            serviceNiche: niche,
            reputationScore: 5000,   // Start at 5.0/10
            totalRatings: 0,
            dealsCompleted: 0,
            dealsAbandoned: 0,
            totalEarnedWei: 0,
            registeredAt: block.timestamp,
            isActive: true
        });

        isRegistered[msg.sender] = true;
        agentIndex.push(msg.sender);

        emit AgentRegistered(msg.sender, name, niche);
    }

    function submitFeedback(
        bytes32 sessionId,
        address rated,
        uint8 score,
        bool deliveredOnTime
    ) external onlyRegistered {
        require(isRegistered[rated], "Rated agent not registered");
        require(score >= 1 && score <= 5, "Score must be 1-5");
        require(msg.sender != rated, "Cannot rate yourself");

        DealFeedback memory fb = DealFeedback({
            sessionId: sessionId,
            rater: msg.sender,
            rated: rated,
            score: score,
            deliveredOnTime: deliveredOnTime,
            timestamp: block.timestamp
        });

        sessionFeedback[sessionId].push(fb);

        // Update reputation: rolling weighted average
        Agent storage agent = agents[rated];
        uint256 oldScore = agent.reputationScore;
        uint256 newRatingBps = uint256(score) * 2000; // score 1-5 → 2000-10000 bps

        // Weight: new rating has 20% weight, history has 80%
        uint256 newScore = (agent.reputationScore * 80 + newRatingBps * 20) / 100;
        agent.reputationScore = newScore;
        agent.totalRatings += 1;

        emit FeedbackSubmitted(sessionId, rated, score);
        emit ReputationUpdated(rated, oldScore, newScore);
    }

    function recordDealCompleted(address agent, uint256 earnedWei) external {
        // In production: restrict to NegotiationEngine contract only
        require(isRegistered[agent], "Agent not registered");
        agents[agent].dealsCompleted += 1;
        agents[agent].totalEarnedWei += earnedWei;
        emit DealStatsUpdated(agent, agents[agent].dealsCompleted, agents[agent].totalEarnedWei);
    }

    function recordDealAbandoned(address agent) external {
        require(isRegistered[agent], "Agent not registered");
        agents[agent].dealsAbandoned += 1;
        // Slight reputation penalty for abandoning
        if (agents[agent].reputationScore > 100) {
            agents[agent].reputationScore -= 100;
        }
    }

    function getReputationScore(address agent) external view returns (uint256) {
        return agents[agent].reputationScore;
    }

    function getAgent(address wallet) external view returns (Agent memory) {
        return agents[wallet];
    }

    function getAgentsByNiche(string calldata niche, uint256 limit)
        external view returns (address[] memory)
    {
        uint256 count = 0;
        for (uint i = 0; i < agentIndex.length; i++) {
            if (keccak256(bytes(agents[agentIndex[i]].serviceNiche)) == keccak256(bytes(niche))
                && agents[agentIndex[i]].isActive) {
                count++;
            }
        }

        uint256 returnCount = count < limit ? count : limit;
        address[] memory result = new address[](returnCount);
        uint256 idx = 0;

        for (uint i = 0; i < agentIndex.length && idx < returnCount; i++) {
            if (keccak256(bytes(agents[agentIndex[i]].serviceNiche)) == keccak256(bytes(niche))
                && agents[agentIndex[i]].isActive) {
                result[idx] = agentIndex[i];
                idx++;
            }
        }

        return result;
    }

    function getTotalAgents() external view returns (uint256) {
        return agentIndex.length;
    }
}
```

### 2.2 — contracts/NegotiationEngine.sol

This is the core state machine. Build it exactly as follows:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract NegotiationEngine {

    // ── Enums ────────────────────────────────────────────────────────────

    enum SessionStatus { OPEN, ACTIVE, AGREED, EXPIRED, CANCELLED }

    // ── Structs ──────────────────────────────────────────────────────────

    struct Session {
        bytes32 sessionId;
        address buyer;
        address seller;
        string serviceDescription;
        uint256 buyerBudgetCap;        // buyer will never pay above this
        uint256 currentRound;
        uint256 maxRounds;
        uint256 agreedPrice;           // set on convergence
        uint256 deadline;              // unix timestamp for expiry
        SessionStatus status;
        uint256[] buyerOffers;         // bid history indexed by round
        uint256[] sellerOffers;        // ask history indexed by round
    }

    // ── Storage ──────────────────────────────────────────────────────────

    mapping(bytes32 => Session) public sessions;
    bytes32[] public sessionIds;
    mapping(address => bytes32[]) public buyerSessions;
    mapping(address => bytes32[]) public sellerSessions;

    // ── Events ───────────────────────────────────────────────────────────

    event SessionOpened(bytes32 indexed sessionId, address indexed buyer, address indexed seller, string serviceDescription);
    event SellerJoined(bytes32 indexed sessionId, address indexed seller);
    event OfferSubmitted(bytes32 indexed sessionId, uint256 round, string role, uint256 amount);
    event DealReached(bytes32 indexed sessionId, uint256 agreedPrice, address buyer, address seller);
    event NegotiationExpired(bytes32 indexed sessionId);
    event SessionCancelled(bytes32 indexed sessionId, address cancelledBy);

    // ── Modifiers ────────────────────────────────────────────────────────

    modifier sessionExists(bytes32 sessionId) {
        require(sessions[sessionId].buyer != address(0), "Session does not exist");
        _;
    }

    modifier onlyBuyer(bytes32 sessionId) {
        require(sessions[sessionId].buyer == msg.sender, "Not the buyer");
        _;
    }

    modifier onlySeller(bytes32 sessionId) {
        require(sessions[sessionId].seller == msg.sender, "Not the seller");
        _;
    }

    modifier sessionActive(bytes32 sessionId) {
        Session storage s = sessions[sessionId];
        require(
            s.status == SessionStatus.OPEN || s.status == SessionStatus.ACTIVE,
            "Session not active"
        );
        require(block.timestamp < s.deadline, "Session expired");
        _;
    }

    // ── Functions ────────────────────────────────────────────────────────

    function openSession(
        address seller,
        string calldata serviceDescription,
        uint256 buyerBudgetCap,
        uint256 maxRounds,
        uint256 durationSeconds
    ) external returns (bytes32 sessionId) {
        require(seller != msg.sender, "Buyer and seller must differ");
        require(seller != address(0), "Invalid seller");
        require(buyerBudgetCap > 0, "Budget cap must be positive");
        require(maxRounds >= 1 && maxRounds <= 10, "Max rounds must be 1-10");
        require(durationSeconds >= 60, "Minimum 60 second duration");

        sessionId = keccak256(abi.encodePacked(
            msg.sender, seller, block.timestamp, block.number
        ));

        require(sessions[sessionId].buyer == address(0), "Session ID collision");

        Session storage s = sessions[sessionId];
        s.sessionId = sessionId;
        s.buyer = msg.sender;
        s.seller = seller;
        s.serviceDescription = serviceDescription;
        s.buyerBudgetCap = buyerBudgetCap;
        s.currentRound = 0;
        s.maxRounds = maxRounds;
        s.agreedPrice = 0;
        s.deadline = block.timestamp + durationSeconds;
        s.status = SessionStatus.OPEN;

        sessionIds.push(sessionId);
        buyerSessions[msg.sender].push(sessionId);
        sellerSessions[seller].push(sessionId);

        emit SessionOpened(sessionId, msg.sender, seller, serviceDescription);
        return sessionId;
    }

    function submitSellerAsk(bytes32 sessionId, uint256 askAmount)
        external
        sessionExists(sessionId)
        onlySeller(sessionId)
        sessionActive(sessionId)
    {
        Session storage s = sessions[sessionId];

        if (s.status == SessionStatus.OPEN) {
            s.status = SessionStatus.ACTIVE;
            emit SellerJoined(sessionId, msg.sender);
        }

        // Seller can only submit one ask per round
        require(s.sellerOffers.length == s.currentRound, "Already submitted this round");
        require(askAmount > 0, "Ask must be positive");

        s.sellerOffers.push(askAmount);
        emit OfferSubmitted(sessionId, s.currentRound, "seller", askAmount);

        _checkConvergenceAndAdvance(sessionId);
    }

    function submitBuyerBid(bytes32 sessionId, uint256 bidAmount)
        external
        sessionExists(sessionId)
        onlyBuyer(sessionId)
        sessionActive(sessionId)
    {
        Session storage s = sessions[sessionId];
        require(s.status == SessionStatus.ACTIVE, "Seller must join first");
        require(bidAmount <= s.buyerBudgetCap, "Bid exceeds budget cap");

        // Buyer can only submit one bid per round
        require(s.buyerOffers.length == s.currentRound, "Already submitted this round");
        require(bidAmount > 0, "Bid must be positive");

        s.buyerOffers.push(bidAmount);
        emit OfferSubmitted(sessionId, s.currentRound, "buyer", bidAmount);

        _checkConvergenceAndAdvance(sessionId);
    }

    function _checkConvergenceAndAdvance(bytes32 sessionId) internal {
        Session storage s = sessions[sessionId];

        // Both must have submitted for the current round
        if (s.buyerOffers.length != s.sellerOffers.length) return;
        if (s.buyerOffers.length == 0) return;

        uint256 latestBid = s.buyerOffers[s.buyerOffers.length - 1];
        uint256 latestAsk = s.sellerOffers[s.sellerOffers.length - 1];

        // Convergence: buyer bid >= seller ask
        if (latestBid >= latestAsk) {
            // Agreed price is the midpoint
            s.agreedPrice = (latestBid + latestAsk) / 2;
            s.status = SessionStatus.AGREED;
            emit DealReached(sessionId, s.agreedPrice, s.buyer, s.seller);
            return;
        }

        // Check if max rounds exhausted
        if (s.currentRound + 1 >= s.maxRounds) {
            s.status = SessionStatus.EXPIRED;
            emit NegotiationExpired(sessionId);
            return;
        }

        // Advance to next round
        s.currentRound += 1;
    }

    function expireSession(bytes32 sessionId)
        external
        sessionExists(sessionId)
    {
        Session storage s = sessions[sessionId];
        require(block.timestamp >= s.deadline, "Session not yet expired");
        require(
            s.status == SessionStatus.OPEN || s.status == SessionStatus.ACTIVE,
            "Session already resolved"
        );
        s.status = SessionStatus.EXPIRED;
        emit NegotiationExpired(sessionId);
    }

    function cancelSession(bytes32 sessionId)
        external
        sessionExists(sessionId)
    {
        Session storage s = sessions[sessionId];
        require(msg.sender == s.buyer, "Only buyer can cancel");
        require(
            s.status == SessionStatus.OPEN || s.status == SessionStatus.ACTIVE,
            "Session already resolved"
        );
        s.status = SessionStatus.CANCELLED;
        emit SessionCancelled(sessionId, msg.sender);
    }

    // ── View functions ───────────────────────────────────────────────────

    function getSession(bytes32 sessionId)
        external view returns (Session memory)
    {
        return sessions[sessionId];
    }

    function getLatestOffers(bytes32 sessionId)
        external view returns (uint256 latestBid, uint256 latestAsk, uint256 round)
    {
        Session storage s = sessions[sessionId];
        latestBid = s.buyerOffers.length > 0
            ? s.buyerOffers[s.buyerOffers.length - 1] : 0;
        latestAsk = s.sellerOffers.length > 0
            ? s.sellerOffers[s.sellerOffers.length - 1] : 0;
        round = s.currentRound;
    }

    function getOfferHistory(bytes32 sessionId)
        external view returns (uint256[] memory bids, uint256[] memory asks)
    {
        Session storage s = sessions[sessionId];
        return (s.buyerOffers, s.sellerOffers);
    }

    function getOpenSessionsForSeller(address seller)
        external view returns (bytes32[] memory openSessions)
    {
        bytes32[] storage all = sellerSessions[seller];
        uint256 count = 0;

        for (uint i = 0; i < all.length; i++) {
            if (sessions[all[i]].status == SessionStatus.OPEN) count++;
        }

        openSessions = new bytes32[](count);
        uint256 idx = 0;
        for (uint i = 0; i < all.length && idx < count; i++) {
            if (sessions[all[i]].status == SessionStatus.OPEN) {
                openSessions[idx++] = all[i];
            }
        }
    }

    function getTotalSessions() external view returns (uint256) {
        return sessionIds.length;
    }
}
```

### 2.3 — scripts/deploy.js

```javascript
const hre = require("hardhat");

async function main() {
  console.log("Deploying to Avalanche Fuji...");

  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("AgentRegistry deployed to:", registryAddress);

  const NegotiationEngine = await hre.ethers.getContractFactory("NegotiationEngine");
  const engine = await NegotiationEngine.deploy();
  await engine.waitForDeployment();
  const engineAddress = await engine.getAddress();
  console.log("NegotiationEngine deployed to:", engineAddress);

  console.log("\n=== Add these to your .env ===");
  console.log(`AGENT_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`NEGOTIATION_ENGINE_ADDRESS=${engineAddress}`);
  console.log("==============================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Run with:
```bash
npx hardhat run scripts/deploy.js --network fuji
```

---

## Phase 3: Python Agents

### 3.1 — agents/contract_client.py

This module wraps all web3.py contract interactions. Build it as a class:

```python
import os
import json
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

FUJI_RPC = os.getenv("FUJI_RPC_URL", "https://api.avax-test.network/ext/bc/C/rpc")

# Paste the compiled ABI from Hardhat artifacts after compiling contracts
REGISTRY_ABI = []   # Fill from artifacts/contracts/AgentRegistry.sol/AgentRegistry.json
ENGINE_ABI = []     # Fill from artifacts/contracts/NegotiationEngine.sol/NegotiationEngine.json

class ContractClient:
    def __init__(self, private_key: str):
        self.w3 = Web3(Web3.HTTPProvider(FUJI_RPC))
        assert self.w3.is_connected(), "Cannot connect to Fuji RPC"
        
        self.account = self.w3.eth.account.from_key(private_key)
        self.address = self.account.address
        
        registry_address = os.getenv("AGENT_REGISTRY_ADDRESS")
        engine_address = os.getenv("NEGOTIATION_ENGINE_ADDRESS")
        
        self.registry = self.w3.eth.contract(
            address=Web3.to_checksum_address(registry_address),
            abi=REGISTRY_ABI
        )
        self.engine = self.w3.eth.contract(
            address=Web3.to_checksum_address(engine_address),
            abi=ENGINE_ABI
        )

    def _send_tx(self, fn, gas=300000):
        """Build, sign, and send a transaction. Return receipt."""
        nonce = self.w3.eth.get_transaction_count(self.address)
        tx = fn.build_transaction({
            "from": self.address,
            "nonce": nonce,
            "gas": gas,
            "gasPrice": self.w3.to_wei("30", "gwei"),
            "chainId": 43113,
        })
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        return receipt

    # ── Registry calls ──────────────────────────────────────────────

    def register_agent(self, name: str, niche: str):
        fn = self.registry.functions.registerAgent(name, niche)
        return self._send_tx(fn)

    def is_registered(self, address: str) -> bool:
        return self.registry.functions.isRegistered(
            Web3.to_checksum_address(address)
        ).call()

    def get_reputation(self, address: str) -> int:
        return self.registry.functions.getReputationScore(
            Web3.to_checksum_address(address)
        ).call()

    def get_agents_by_niche(self, niche: str, limit: int = 5) -> list:
        return self.registry.functions.getAgentsByNiche(niche, limit).call()

    def submit_feedback(self, session_id: bytes, rated: str, score: int, on_time: bool):
        fn = self.registry.functions.submitFeedback(session_id, rated, score, on_time)
        return self._send_tx(fn)

    # ── NegotiationEngine calls ─────────────────────────────────────

    def open_session(self, seller: str, description: str, budget_cap_wei: int,
                     max_rounds: int, duration_seconds: int) -> bytes:
        fn = self.engine.functions.openSession(
            Web3.to_checksum_address(seller),
            description,
            budget_cap_wei,
            max_rounds,
            duration_seconds
        )
        receipt = self._send_tx(fn)
        
        # Parse SessionOpened event to get sessionId
        logs = self.engine.events.SessionOpened().process_receipt(receipt)
        if logs:
            return logs[0]["args"]["sessionId"]
        raise RuntimeError("SessionOpened event not found in receipt")

    def submit_buyer_bid(self, session_id: bytes, bid_wei: int):
        fn = self.engine.functions.submitBuyerBid(session_id, bid_wei)
        return self._send_tx(fn)

    def submit_seller_ask(self, session_id: bytes, ask_wei: int):
        fn = self.engine.functions.submitSellerAsk(session_id, ask_wei)
        return self._send_tx(fn)

    def get_session(self, session_id: bytes) -> dict:
        s = self.engine.functions.getSession(session_id).call()
        return {
            "sessionId": s[0].hex(),
            "buyer": s[1],
            "seller": s[2],
            "serviceDescription": s[3],
            "buyerBudgetCap": s[4],
            "currentRound": s[5],
            "maxRounds": s[6],
            "agreedPrice": s[7],
            "deadline": s[8],
            "status": s[9],
            "buyerOffers": list(s[10]),
            "sellerOffers": list(s[11]),
        }

    def get_latest_offers(self, session_id: bytes) -> dict:
        bid, ask, round_num = self.engine.functions.getLatestOffers(session_id).call()
        return {"latestBid": bid, "latestAsk": ask, "round": round_num}

    def get_open_sessions_for_seller(self, seller: str) -> list:
        return self.engine.functions.getOpenSessionsForSeller(
            Web3.to_checksum_address(seller)
        ).call()

    def poll_for_deal(self, session_id: bytes) -> dict | None:
        """Returns session dict if status is AGREED (2), else None."""
        session = self.get_session(session_id)
        if session["status"] == 2:  # AGREED
            return session
        return None
```

### 3.2 — agents/strategy.py

This module calls Claude API to decide negotiation strategy. Build it exactly as follows:

```python
import os
import json
import anthropic
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

def get_buyer_strategy(
    current_ask_usdc: float,
    budget_cap_usdc: float,
    current_round: int,
    max_rounds: int,
    seller_reputation: int,      # 0-10000 basis points
    bid_history: list[float],    # buyer's previous bids
    ask_history: list[float],    # seller's previous asks
    service_description: str,
) -> dict:
    """
    Ask Claude to decide the buyer's next bid.
    Returns { "offer": float, "reasoning": str }
    """
    seller_rep_display = seller_reputation / 1000  # convert bps to 0-10 scale
    
    prompt = f"""You are an autonomous Buyer AI agent in a price negotiation. You must decide your next bid.

SERVICE: {service_description}

NEGOTIATION STATE:
- Your maximum budget: {budget_cap_usdc} USDC (NEVER exceed this)
- Seller's current asking price: {current_ask_usdc} USDC
- Current round: {current_round + 1} of {max_rounds}
- Rounds remaining: {max_rounds - current_round - 1}
- Seller reputation: {seller_rep_display:.1f}/10 (higher = more trustworthy, pay closer to their ask)
- Your bid history: {bid_history}
- Seller ask history: {ask_history}

STRATEGY RULES:
1. NEVER bid above {budget_cap_usdc} USDC
2. Increase your bid each round — never decrease
3. If seller reputation > 8.0: be willing to concede more aggressively
4. If seller reputation < 5.0: hold firm, they need the deal more
5. As rounds run out, increase concession speed significantly
6. If the ask is already close to your budget cap, offer a final high bid
7. Calculate how fast the seller is conceding and match their pace (reciprocity)

Respond ONLY with valid JSON, no other text:
{{"offer": <number>, "reasoning": "<one concise sentence explaining this bid>"}}"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}]
    )
    
    raw = response.content[0].text.strip()
    # Strip any accidental markdown fences
    raw = raw.replace("```json", "").replace("```", "").strip()
    result = json.loads(raw)
    
    # Safety clamp
    result["offer"] = min(float(result["offer"]), budget_cap_usdc)
    result["offer"] = max(float(result["offer"]), 0.01)
    
    return result


def get_seller_strategy(
    current_bid_usdc: float,
    floor_price_usdc: float,
    current_round: int,
    max_rounds: int,
    buyer_reputation: int,       # 0-10000 basis points
    ask_history: list[float],    # seller's previous asks
    bid_history: list[float],    # buyer's previous bids
    service_description: str,
) -> dict:
    """
    Ask Claude to decide the seller's next ask.
    Returns { "offer": float, "reasoning": str }
    """
    buyer_rep_display = buyer_reputation / 1000
    
    prompt = f"""You are an autonomous Seller AI agent in a price negotiation. You must decide your next asking price.

SERVICE: {service_description}

NEGOTIATION STATE:
- Your floor price (minimum acceptable): {floor_price_usdc} USDC (NEVER go below this)
- Buyer's current bid: {current_bid_usdc} USDC
- Current round: {current_round + 1} of {max_rounds}
- Rounds remaining: {max_rounds - current_round - 1}
- Buyer reputation: {buyer_rep_display:.1f}/10 (higher = reliable payer, you can afford to concede)
- Your ask history: {ask_history}
- Buyer bid history: {bid_history}

STRATEGY RULES:
1. NEVER ask below {floor_price_usdc} USDC
2. Decrease your ask each round — never increase
3. If buyer reputation > 8.0: concede more generously, they are a good customer
4. If buyer reputation < 5.0: hold firm, require higher price as risk premium
5. As rounds run out, reduce your ask faster
6. If the bid is already very close to your floor price, make a final concession to close the deal
7. Calculate how fast the buyer is bidding up and match their pace (reciprocity)

Respond ONLY with valid JSON, no other text:
{{"offer": <number>, "reasoning": "<one concise sentence explaining this ask>"}}"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}]
    )
    
    raw = response.content[0].text.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    result = json.loads(raw)
    
    # Safety clamp
    result["offer"] = max(float(result["offer"]), floor_price_usdc)
    
    return result
```

### 3.3 — agents/x402_client.py

This implements the x402 payment protocol. The seller runs a Flask server that returns 402 until paid.

```python
"""
x402 Payment Protocol Implementation

Flow:
1. Buyer requests seller's service endpoint
2. Seller returns HTTP 402 with payment instructions
3. Buyer sees agreed price, sends on-chain USDC transfer
4. Buyer retries with payment proof (tx hash)
5. Seller verifies tx hash, returns service content
"""

import os
import requests
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

FUJI_RPC = os.getenv("FUJI_RPC_URL", "https://api.avax-test.network/ext/bc/C/rpc")

# Mock USDC on Fuji — use this test USDC contract or deploy your own ERC20
# For hackathon: we simulate payment via AVAX transfer to keep it simple
# Replace with actual USDC address if using real stablecoin on Fuji

class X402Client:
    """Buyer-side x402 client."""
    
    def __init__(self, private_key: str):
        self.w3 = Web3(Web3.HTTPProvider(FUJI_RPC))
        self.account = self.w3.eth.account.from_key(private_key)
        self.address = self.account.address

    def request_service(self, endpoint_url: str, agreed_price_wei: int) -> dict:
        """
        Make an x402 payment and retrieve service content.
        
        1. GET endpoint → expect 402 with payment info
        2. Send on-chain payment
        3. Retry GET with X-Payment-Tx header
        4. Return service content
        """
        print(f"[x402] Requesting {endpoint_url}")
        
        # Step 1: Initial request — expect 402
        response = requests.get(endpoint_url, timeout=10)
        
        if response.status_code == 402:
            payment_info = response.json()
            print(f"[x402] Payment required: {payment_info}")
            
            # Step 2: Send payment
            tx_hash = self._send_payment(
                to=payment_info["paymentAddress"],
                amount_wei=agreed_price_wei
            )
            print(f"[x402] Payment sent: {tx_hash}")
            
            # Step 3: Retry with payment proof
            retry = requests.get(
                endpoint_url,
                headers={"X-Payment-Tx": tx_hash},
                timeout=10
            )
            
            if retry.status_code == 200:
                print(f"[x402] Service received!")
                return retry.json()
            else:
                raise RuntimeError(f"Service delivery failed after payment: {retry.status_code}")
        
        elif response.status_code == 200:
            # Already paid (payment header was pre-set)
            return response.json()
        else:
            raise RuntimeError(f"Unexpected response: {response.status_code}")

    def _send_payment(self, to: str, amount_wei: int) -> str:
        """Send AVAX payment on Fuji (simulating USDC for hackathon demo)."""
        nonce = self.w3.eth.get_transaction_count(self.address)
        tx = {
            "to": Web3.to_checksum_address(to),
            "value": amount_wei,
            "gas": 21000,
            "gasPrice": self.w3.to_wei("30", "gwei"),
            "nonce": nonce,
            "chainId": 43113,
        }
        signed = self.w3.eth.account.sign_transaction(tx, self.account.key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        return tx_hash.hex()


class X402Server:
    """
    Seller-side x402 server.
    Run as a Flask app. Checks for payment before delivering service.
    """
    
    def __init__(self, seller_address: str, w3: Web3):
        self.seller_address = seller_address
        self.w3 = w3
        self.paid_transactions = set()  # In production: persist this
    
    def create_flask_app(self, service_content: dict, price_wei: int):
        """
        Returns a Flask app that gates service_content behind x402.
        Mount this at /service endpoint.
        """
        from flask import Flask, request, jsonify
        
        app = Flask(__name__)
        
        @app.route("/service", methods=["GET"])
        def serve():
            payment_tx = request.headers.get("X-Payment-Tx")
            
            if not payment_tx:
                # Return 402 with payment instructions
                return jsonify({
                    "x402Version": "1.0",
                    "paymentRequired": True,
                    "paymentAddress": self.seller_address,
                    "chain": "avalanche-fuji",
                    "chainId": 43113,
                    "currency": "AVAX",
                    "memo": "x402 service payment"
                }), 402
            
            # Verify payment transaction
            if self._verify_payment(payment_tx, price_wei):
                self.paid_transactions.add(payment_tx)
                return jsonify({
                    "status": "delivered",
                    "content": service_content,
                    "paymentTx": payment_tx
                }), 200
            else:
                return jsonify({"error": "Payment verification failed"}), 402
        
        return app
    
    def _verify_payment(self, tx_hash: str, expected_wei: int) -> bool:
        """Verify the payment transaction on-chain."""
        if tx_hash in self.paid_transactions:
            return False  # Already used
        
        try:
            tx = self.w3.eth.get_transaction(tx_hash)
            receipt = self.w3.eth.get_transaction_receipt(tx_hash)
            
            is_to_seller = tx["to"].lower() == self.seller_address.lower()
            is_sufficient = tx["value"] >= int(expected_wei * 0.99)  # 1% tolerance
            is_confirmed = receipt["status"] == 1
            is_on_fuji = tx["chainId"] == 43113
            
            return is_to_seller and is_sufficient and is_confirmed and is_on_fuji
        except Exception as e:
            print(f"[x402] Payment verification error: {e}")
            return False
```

### 3.4 — agents/buyer_agent.py

```python
"""
Buyer Agent: negotiates autonomously, pays via x402 on deal.
"""

import os
import time
import threading
from web3 import Web3
from dotenv import load_dotenv
from contract_client import ContractClient
from strategy import get_buyer_strategy
from x402_client import X402Client

load_dotenv()

BUYER_PRIVATE_KEY = os.getenv("BUYER_PRIVATE_KEY")
SELLER_ADDRESS = os.getenv("SELLER_WALLET_ADDRESS")       # set this before running
SELLER_ENDPOINT = os.getenv("SELLER_SERVICE_ENDPOINT", "http://localhost:5001/service")
BUDGET_CAP_USDC = float(os.getenv("BUYER_BUDGET_CAP", "100"))
MAX_ROUNDS = int(os.getenv("MAX_ROUNDS", "5"))
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL_SECONDS", "8"))
SERVICE_DESCRIPTION = os.getenv("SERVICE_DESCRIPTION", "AI-powered market analysis report for Avalanche DeFi protocols")
NICHE = os.getenv("SERVICE_NICHE", "data-analysis")

# Convert USDC amount to wei equivalent for on-chain (using 18 decimals for AVAX sim)
BUDGET_CAP_WEI = Web3.to_wei(BUDGET_CAP_USDC / 1000, "ether")  # divide by 1000 to keep test amounts small


def run_buyer_agent():
    print("[Buyer] Starting Autonomous Buyer Agent")
    
    client = ContractClient(BUYER_PRIVATE_KEY)
    x402 = X402Client(BUYER_PRIVATE_KEY)
    
    buyer_address = client.address
    print(f"[Buyer] Address: {buyer_address}")

    # Step 1: Register if not already registered
    if not client.is_registered(buyer_address):
        print("[Buyer] Registering agent on-chain...")
        client.register_agent("Buyer-Agent-Alpha", NICHE)
        print("[Buyer] Registered successfully")
    else:
        rep = client.get_reputation(buyer_address)
        print(f"[Buyer] Already registered. Reputation: {rep/1000:.1f}/10")

    # Step 2: Check seller's reputation before engaging
    seller_rep = client.get_reputation(SELLER_ADDRESS)
    print(f"[Buyer] Seller reputation: {seller_rep/1000:.1f}/10")

    if seller_rep < 2000:  # Below 2.0/10
        print("[Buyer] Seller reputation too low. Aborting.")
        return

    # Step 3: Open negotiation session
    print(f"[Buyer] Opening negotiation for: '{SERVICE_DESCRIPTION}'")
    session_id = client.open_session(
        seller=SELLER_ADDRESS,
        description=SERVICE_DESCRIPTION,
        budget_cap_wei=BUDGET_CAP_WEI,
        max_rounds=MAX_ROUNDS,
        duration_seconds=600   # 10 minute session window
    )
    print(f"[Buyer] Session opened: {session_id.hex()}")

    # Step 4: Negotiate in rounds
    negotiation_active = True
    last_submitted_round = -1
    
    while negotiation_active:
        time.sleep(POLL_INTERVAL)
        
        session = client.get_session(session_id)
        status = session["status"]
        
        # Status codes: 0=OPEN, 1=ACTIVE, 2=AGREED, 3=EXPIRED, 4=CANCELLED
        if status == 2:  # AGREED
            agreed_price_wei = session["agreedPrice"]
            agreed_price_usdc = Web3.from_wei(agreed_price_wei, "ether") * 1000
            print(f"\n[Buyer] 🤝 DEAL REACHED at {agreed_price_usdc:.4f} USDC")
            
            # Step 5: Pay via x402
            print(f"[Buyer] Triggering x402 payment to {SELLER_ENDPOINT}...")
            result = x402.request_service(SELLER_ENDPOINT, agreed_price_wei)
            print(f"[Buyer] Service received: {result}")
            
            # Step 6: Submit feedback
            time.sleep(3)
            print("[Buyer] Submitting feedback to registry...")
            client.submit_feedback(session_id, SELLER_ADDRESS, 5, True)
            print("[Buyer] Feedback submitted. Negotiation complete.")
            negotiation_active = False
            break
        
        elif status in (3, 4):  # EXPIRED or CANCELLED
            print(f"[Buyer] Session ended with status: {status}")
            negotiation_active = False
            break
        
        current_round = session["currentRound"]
        buyer_offers = session["buyerOffers"]
        seller_offers = session["sellerOffers"]
        
        # Only bid if it's our turn (seller has submitted for current round, we haven't)
        if (len(seller_offers) > len(buyer_offers) and
            current_round == len(buyer_offers) and
            current_round != last_submitted_round):
            
            latest_ask_wei = seller_offers[-1]
            latest_ask_usdc = Web3.from_wei(latest_ask_wei, "ether") * 1000
            
            # Convert histories to USDC for Claude
            bids_usdc = [Web3.from_wei(b, "ether") * 1000 for b in buyer_offers]
            asks_usdc = [Web3.from_wei(a, "ether") * 1000 for a in seller_offers]
            
            print(f"\n[Buyer] Round {current_round + 1}/{MAX_ROUNDS}")
            print(f"[Buyer] Current ask: {latest_ask_usdc:.4f} USDC")
            
            # Ask Claude for strategy
            strategy = get_buyer_strategy(
                current_ask_usdc=float(latest_ask_usdc),
                budget_cap_usdc=BUDGET_CAP_USDC,
                current_round=current_round,
                max_rounds=MAX_ROUNDS,
                seller_reputation=seller_rep,
                bid_history=list(bids_usdc),
                ask_history=list(asks_usdc),
                service_description=SERVICE_DESCRIPTION,
            )
            
            new_bid_usdc = strategy["offer"]
            reasoning = strategy["reasoning"]
            new_bid_wei = int(Web3.to_wei(new_bid_usdc / 1000, "ether"))
            
            print(f"[Buyer] Claude says: bid {new_bid_usdc:.4f} USDC — {reasoning}")
            
            # Submit bid on-chain
            client.submit_buyer_bid(session_id, new_bid_wei)
            last_submitted_round = current_round
            print(f"[Buyer] Bid submitted on-chain ✓")


if __name__ == "__main__":
    run_buyer_agent()
```

### 3.5 — agents/seller_agent.py

```python
"""
Seller Agent: listens for sessions, negotiates, delivers via x402.
"""

import os
import time
import threading
from web3 import Web3
from flask import Flask
from dotenv import load_dotenv
from contract_client import ContractClient
from strategy import get_seller_strategy
from x402_client import X402Server

load_dotenv()

SELLER_PRIVATE_KEY = os.getenv("SELLER_PRIVATE_KEY")
FLOOR_PRICE_USDC = float(os.getenv("SELLER_FLOOR_PRICE", "40"))
MAX_ROUNDS = int(os.getenv("MAX_ROUNDS", "5"))
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL_SECONDS", "8"))
SERVICE_PORT = int(os.getenv("SELLER_SERVICE_PORT", "5001"))
NICHE = os.getenv("SERVICE_NICHE", "data-analysis")

FLOOR_PRICE_WEI = int(Web3.to_wei(FLOOR_PRICE_USDC / 1000, "ether"))

# The service content delivered after payment
SERVICE_CONTENT = {
    "type": "market-analysis",
    "title": "Avalanche DeFi Protocol Analysis",
    "content": "Top protocols by TVL: Aave V3, Trader Joe, Benqi. Recommended allocation: 40% stable yield, 30% LP, 30% lending. Risk score: 6.2/10.",
    "generatedAt": "2026-06-15",
    "analyst": "Seller-Agent-Beta"
}

# Shared state between Flask server and negotiation loop
current_agreed_price_wei = None
active_sessions = {}


def run_x402_server(seller_address: str, w3: Web3):
    """Run Flask x402 server in a background thread."""
    x402_server = X402Server(seller_address, w3)
    app = x402_server.create_flask_app(SERVICE_CONTENT, FLOOR_PRICE_WEI)
    
    # Override price with agreed price when available
    @app.route("/service", methods=["GET"])
    def serve_with_dynamic_price():
        global current_agreed_price_wei
        price = current_agreed_price_wei or FLOOR_PRICE_WEI
        # Reuse X402Server logic with dynamic price
        from flask import request, jsonify
        payment_tx = request.headers.get("X-Payment-Tx")
        if not payment_tx:
            return jsonify({
                "x402Version": "1.0",
                "paymentRequired": True,
                "paymentAddress": seller_address,
                "chain": "avalanche-fuji",
                "chainId": 43113,
                "currency": "AVAX",
                "agreedPriceWei": str(price)
            }), 402
        if x402_server._verify_payment(payment_tx, price):
            x402_server.paid_transactions.add(payment_tx)
            return jsonify({"status": "delivered", "content": SERVICE_CONTENT, "paymentTx": payment_tx}), 200
        return jsonify({"error": "Payment verification failed"}), 402
    
    print(f"[Seller] x402 server starting on port {SERVICE_PORT}")
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=False)


def run_seller_agent():
    global current_agreed_price_wei
    
    print("[Seller] Starting Autonomous Seller Agent")
    
    client = ContractClient(SELLER_PRIVATE_KEY)
    w3 = client.w3
    seller_address = client.address
    print(f"[Seller] Address: {seller_address}")

    # Start x402 server in background thread
    server_thread = threading.Thread(
        target=run_x402_server,
        args=(seller_address, w3),
        daemon=True
    )
    server_thread.start()
    time.sleep(1)  # Give Flask time to boot

    # Register if needed
    if not client.is_registered(seller_address):
        print("[Seller] Registering agent on-chain...")
        client.register_agent("Seller-Agent-Beta", NICHE)
        print("[Seller] Registered successfully")
    else:
        rep = client.get_reputation(seller_address)
        print(f"[Seller] Already registered. Reputation: {rep/1000:.1f}/10")

    # Poll for open sessions and negotiate
    handled_sessions = set()
    last_submitted = {}

    while True:
        time.sleep(POLL_INTERVAL)
        
        try:
            open_sessions = client.get_open_sessions_for_seller(seller_address)
        except Exception as e:
            print(f"[Seller] Error polling sessions: {e}")
            continue
        
        for session_id in open_sessions:
            session_hex = session_id.hex() if isinstance(session_id, bytes) else session_id.hex()
            
            if session_hex in handled_sessions:
                continue
            
            session = client.get_session(session_id)
            
            # Check buyer's reputation
            buyer_address = session["buyer"]
            buyer_rep = client.get_reputation(buyer_address)
            
            if buyer_rep < 1000:  # Below 1.0/10
                print(f"[Seller] Ignoring session from low-rep buyer: {buyer_rep/1000:.1f}/10")
                handled_sessions.add(session_hex)
                continue
            
            print(f"\n[Seller] Found open session: {session_hex[:16]}...")
            print(f"[Seller] Service: {session['serviceDescription']}")
            print(f"[Seller] Buyer reputation: {buyer_rep/1000:.1f}/10")
            
            active_sessions[session_hex] = session
            handled_sessions.add(session_hex)

        # Handle active sessions
        for session_hex in list(active_sessions.keys()):
            session_id_bytes = bytes.fromhex(session_hex)
            session = client.get_session(session_id_bytes)
            status = session["status"]
            
            if status == 2:  # AGREED
                agreed_wei = session["agreedPrice"]
                current_agreed_price_wei = agreed_wei
                agreed_usdc = Web3.from_wei(agreed_wei, "ether") * 1000
                print(f"\n[Seller] 🤝 DEAL REACHED at {agreed_usdc:.4f} USDC")
                print("[Seller] x402 server ready to accept payment")
                
                # Submit feedback after a delay (simulating delivery confirmation)
                time.sleep(15)
                buyer_address = session["buyer"]
                client.submit_feedback(session_id_bytes, buyer_address, 5, True)
                print("[Seller] Feedback submitted")
                del active_sessions[session_hex]
                continue
            
            if status in (3, 4):
                print(f"[Seller] Session {session_hex[:16]} ended: status={status}")
                del active_sessions[session_hex]
                continue
            
            current_round = session["currentRound"]
            buyer_offers = session["buyerOffers"]
            seller_offers = session["sellerOffers"]
            
            # Submit ask if: buyer has bid for this round and we haven't asked yet
            round_key = f"{session_hex}:{current_round}"
            if (len(buyer_offers) > len(seller_offers) and
                current_round == len(seller_offers) and
                round_key not in last_submitted):
                
                latest_bid_wei = buyer_offers[-1]
                latest_bid_usdc = Web3.from_wei(latest_bid_wei, "ether") * 1000
                buyer_rep = client.get_reputation(session["buyer"])
                
                bids_usdc = [Web3.from_wei(b, "ether") * 1000 for b in buyer_offers]
                asks_usdc = [Web3.from_wei(a, "ether") * 1000 for a in seller_offers]
                
                print(f"\n[Seller] Round {current_round + 1}/{MAX_ROUNDS}")
                print(f"[Seller] Current bid: {latest_bid_usdc:.4f} USDC")
                
                strategy = get_seller_strategy(
                    current_bid_usdc=float(latest_bid_usdc),
                    floor_price_usdc=FLOOR_PRICE_USDC,
                    current_round=current_round,
                    max_rounds=MAX_ROUNDS,
                    buyer_reputation=buyer_rep,
                    ask_history=list(asks_usdc),
                    bid_history=list(bids_usdc),
                    service_description=session["serviceDescription"],
                )
                
                new_ask_usdc = strategy["offer"]
                reasoning = strategy["reasoning"]
                new_ask_wei = int(Web3.to_wei(new_ask_usdc / 1000, "ether"))
                
                print(f"[Seller] Claude says: ask {new_ask_usdc:.4f} USDC — {reasoning}")
                
                client.submit_seller_ask(session_id_bytes, new_ask_wei)
                last_submitted[round_key] = True
                print(f"[Seller] Ask submitted on-chain ✓")


if __name__ == "__main__":
    run_seller_agent()
```

### 3.6 — scripts/seed_agents.py

```python
"""
Register both buyer and seller agents on-chain with starting reputation.
Run this once after deploy.
"""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../agents"))

from contract_client import ContractClient
from dotenv import load_dotenv

load_dotenv()

def seed():
    print("Seeding agents...")

    buyer = ContractClient(os.getenv("BUYER_PRIVATE_KEY"))
    seller = ContractClient(os.getenv("SELLER_PRIVATE_KEY"))
    niche = os.getenv("SERVICE_NICHE", "data-analysis")

    if not buyer.is_registered(buyer.address):
        buyer.register_agent("Buyer-Agent-Alpha", niche)
        print(f"Buyer registered: {buyer.address}")
    else:
        print(f"Buyer already registered: {buyer.address}")

    if not seller.is_registered(seller.address):
        seller.register_agent("Seller-Agent-Beta", niche)
        print(f"Seller registered: {seller.address}")
    else:
        print(f"Seller already registered: {seller.address}")

    buyer_rep = buyer.get_reputation(buyer.address)
    seller_rep = seller.get_reputation(seller.address)
    print(f"\nBuyer reputation: {buyer_rep/1000:.1f}/10")
    print(f"Seller reputation: {seller_rep/1000:.1f}/10")
    print("\nSeed complete. Ready to negotiate.")

if __name__ == "__main__":
    seed()
```

---

## Phase 4: Frontend (Next.js)

### 4.1 — Initialize

```bash
cd frontend
npx create-next-app@14 . --typescript --tailwind --app
npm install ethers recharts
```

### 4.2 — pages/index.tsx (main page)

Build a single-page app showing:

1. **Header**: "Autonomous Negotiation Protocol" — two agent wallets and their ERC-8004 reputation scores displayed as badges

2. **Session Panel** (left, 50%):
   - Active session ID (truncated)
   - Service description
   - Status badge: OPEN / ACTIVE / AGREED / EXPIRED
   - Current round counter
   - Countdown timer to session deadline

3. **Negotiation Chart** (center):
   - Line chart using recharts with two lines: Buyer Bids (blue) and Seller Asks (green)
   - X-axis: rounds (1, 2, 3...)
   - Y-axis: USDC price
   - Convergence zone highlighted in amber when gap < 20%
   - Animated "DEAL" badge appears on convergence

4. **Offer Feed** (right, 50%):
   - Scrolling live feed of each offer event
   - Format: "[Round 2 · Seller] 73.50 USDC — "Buyer is conceding quickly, matching pace""
   - Each entry shows the Claude reasoning

5. **x402 Payment Panel** (bottom, appears on AGREED):
   - Agreed price
   - "Payment firing..." → tx hash link to Snowtrace
   - "Service delivered ✓" with content preview

6. **Reputation Panel** (bottom right):
   - Both agent cards showing name, wallet, rep score as a progress bar (0-10)
   - Deal count and total earned

Poll contract state every 5 seconds using ethers.js.

Read events from NegotiationEngine using `contract.queryFilter(contract.filters.OfferSubmitted())`.

Use Tailwind for styling. Dark mode preferred.

---

## Phase 5: Contract Tests

### 5.1 — test/NegotiationEngine.test.js

Write comprehensive tests covering:

1. `openSession()` — creates session with correct fields
2. `submitSellerAsk()` — fails if not seller, fails if wrong round, succeeds otherwise
3. `submitBuyerBid()` — fails if exceeds budget cap, fails if before seller joins
4. Convergence detection — when bid >= ask, status becomes AGREED and DealReached emits
5. `expireSession()` — only callable after deadline
6. Max rounds exhaustion — status becomes EXPIRED after max rounds with no convergence
7. Full negotiation simulation — 3-round scenario: 100→85→73→65 ask, 20→40→58→65 bid, converges round 3

---

## Phase 6: Demo Setup Script

Create `demo.sh`:

```bash
#!/bin/bash
echo "=== Autonomous Negotiation Protocol Demo ==="

# Terminal 1: Start seller agent + x402 server
echo "Starting Seller Agent in background..."
cd agents && python seller_agent.py &
SELLER_PID=$!
sleep 3

# Terminal 2: Start buyer agent
echo "Starting Buyer Agent..."
python buyer_agent.py

# Wait for completion
wait $SELLER_PID
echo "=== Demo complete ==="
```

---

## Phase 7: README.md

Write a README with:

1. **What it is**: One paragraph. Agents negotiate price autonomously. x402 fires on convergence. ERC-8004 informs strategy.

2. **How it works**: The negotiation algorithm in plain English. Show the example convergence table (Round 0-3 with bid/ask values).

3. **Tech stack**: bullet list

4. **Deployed contracts**: 
   - AgentRegistry: [Fuji Snowtrace link]
   - NegotiationEngine: [Fuji Snowtrace link]

5. **How to run**:
```bash
# Install
npm install
pip install web3 anthropic python-dotenv requests flask

# Configure
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, BUYER_PRIVATE_KEY, SELLER_PRIVATE_KEY

# Deploy contracts
npx hardhat run scripts/deploy.js --network fuji
# Copy addresses to .env

# Seed agents on-chain
python scripts/seed_agents.py

# Run demo
./demo.sh
```

6. **What's new for this Speedrun**: State clearly that this is a new project built for Team1 India Speedrun.

7. **How x402 is used**: HTTP 402 flow with payment proof. Buyer pays seller's wallet directly. No platform.

8. **How ERC-8004 is used**: Identity registry for both agents. Reputation score feeds into Claude's strategy prompt. Feedback submitted after each deal.

---

## Critical Implementation Notes

1. **ABI loading**: After running `npx hardhat compile`, copy the ABI arrays from `artifacts/contracts/AgentRegistry.sol/AgentRegistry.json` and `artifacts/contracts/NegotiationEngine.sol/NegotiationEngine.json` into `contract_client.py`.

2. **Fuji test AVAX**: Get free AVAX from https://faucet.avax.network/ for both buyer and seller wallets.

3. **Price units**: The contracts use wei-equivalent amounts. The agents convert USDC amounts by dividing by 1000 then converting to wei (so 50 USDC = 0.05 AVAX equivalent) to keep test amounts within Fuji faucet limits.

4. **Turn order**: Seller submits first ask before buyer can bid. In the buyer agent, poll for seller ask before submitting bid. In seller agent, submit initial ask immediately on joining a session.

5. **Initial ask**: The seller's first ask (round 0) is not reactive — it's a fixed starting point. Add logic in seller_agent.py to submit an initial ask when the session first transitions to ACTIVE, before any buyer bid exists. Use a simple heuristic: `initial_ask = floor_price * 2.5` capped at buyer's budget cap.

6. **Session ID type**: The session ID is bytes32 on-chain. In Python/web3.py it comes back as a bytes object. Store as bytes, convert to hex for display using `.hex()`.

7. **Polling race condition**: Both agents poll every 8 seconds. Use `last_submitted_round` tracking to ensure each agent only submits once per round even if the poll fires multiple times.

8. **x402 amount tolerance**: The `_verify_payment` function uses a 1% tolerance. Adjust if needed for demo purposes.

9. **Flask and buyer concurrency**: Run seller Flask server in a daemon thread so it doesn't block the negotiation polling loop.

10. **Demo timing**: With POLL_INTERVAL=8 and 5 rounds, a full negotiation takes ~80 seconds. Perfect for a live demo.

---

## What This Demonstrates for Judges

- **x402**: Buyer agent makes an HTTP request, gets 402, sends on-chain payment, retries and receives service. Full protocol flow, live on Fuji.
- **ERC-8004**: Both agents have on-chain identity. Reputation scores are read before engaging and written after each deal. Strategy is reputation-aware.
- **Avalanche C-Chain**: All negotiation state lives on Fuji. Every offer is an on-chain transaction. Settlement is on-chain. Snowtrace links for every tx.
- **Autonomous**: Zero human decisions after `python buyer_agent.py` is run. Agents discover each other, negotiate, pay, deliver, rate. The entire economy runs itself.
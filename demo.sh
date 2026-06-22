#!/bin/bash
set -e

echo "╔══════════════════════════════════════════════════╗"
echo "║  Autonomous Negotiation Protocol — Demo         ║"
echo "║  Team1 India · Speedrun: Agentic Payments       ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Check for required env vars
if [ ! -f .env ]; then
    echo "ERROR: .env file not found. Run: cp .env.example .env"
    exit 1
fi

# Source .env for key checks
source .env 2>/dev/null || true

if [ "$ANTHROPIC_API_KEY" = "your_key_here" ] || [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "WARNING: ANTHROPIC_API_KEY not configured. Set it in .env"
    echo "The agents will fail when calling the LLM strategy."
    echo ""
fi

# Validate contract addresses
if [ -z "$NEGOTIATION_ENGINE_ADDRESS" ] || [ -z "$AGENT_REGISTRY_ADDRESS" ]; then
    echo "ERROR: Contract addresses not set in .env"
    echo "Run: npx hardhat run scripts/deploy.js --network fuji"
    exit 1
fi

echo "Agent config:"
echo "  Buyer budget cap: ${BUYER_BUDGET_CAP:-100} USDC"
echo "  Seller floor price: ${SELLER_FLOOR_PRICE:-40} USDC"
echo "  Max rounds: ${MAX_ROUNDS:-5}"
echo "  Poll interval: ${POLL_INTERVAL_SECONDS:-8}s"
echo ""

# Start seller agent + x402 server
echo "▶ Starting Seller Agent (x402 server on port ${SELLER_SERVICE_PORT:-5001})..."
cd agents
python seller_agent.py &
SELLER_PID=$!
cd ..
sleep 3

# Check seller process is alive
if ! kill -0 $SELLER_PID 2>/dev/null; then
    echo "ERROR: Seller agent failed to start"
    exit 1
fi

# Start buyer agent
echo ""
echo "▶ Starting Buyer Agent..."
cd agents
python buyer_agent.py
BUYER_EXIT=$?
cd ..

# Wait for seller to finish
echo ""
echo "Waiting for Seller Agent to finalize..."
wait $SELLER_PID 2>/dev/null || true

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  Demo complete                                  ║"
echo "╚══════════════════════════════════════════════════╝"
exit $BUYER_EXIT

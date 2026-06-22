#!/bin/bash
set -e
echo ""
echo "=== AgentPact — Live Fuji Demo ==="
echo ""

# Check env
if [ -z "$BUYER_PRIVATE_KEY" ] || [ -z "$SELLER_PRIVATE_KEY" ]; then
  echo "ERROR: Set BUYER_PRIVATE_KEY and SELLER_PRIVATE_KEY in .env"
  exit 1
fi

echo "Starting seller agent (background)..."
cd agents && python seller_demo.py &
SELLER_PID=$!

echo "Waiting for seller to boot..."
sleep 5

echo "Starting buyer agent..."
python buyer_demo.py

echo ""
echo "Waiting for negotiation to complete..."
wait $SELLER_PID

echo ""
echo "=== Demo complete. Check marketplace at http://localhost:3000 ==="

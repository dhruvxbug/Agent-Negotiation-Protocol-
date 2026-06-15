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

#!/bin/bash
# Test production mode rejects demo code 888888

set -e

echo "===== Testing Production Mode Security ====="
echo ""

# Start server in production mode
export NODE_ENV=production
export DATABASE_PATH="/tmp/test-prod-db-$$.json"
cp "$(dirname "$0")/data/db.json" "$DATABASE_PATH"

echo "[1] Starting server in production mode..."
node src/index.js > /tmp/prod-server.log 2>&1 &
SERVER_PID=$!
sleep 3

echo "[2] Testing demo code 888888 is rejected..."
RESPONSE=$(curl -s -X POST http://127.0.0.1:8787/api/auth/sms/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"13980889211","code":"888888","scene":"login"}')

echo "   Response: $RESPONSE"

SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "false" ]; then
  echo "   ✓ Production mode correctly rejects 888888"
else
  echo "   ✗ ERROR: Production mode accepted 888888!"
  kill $SERVER_PID
  exit 1
fi

echo ""
echo "[3] Cleaning up..."
kill $SERVER_PID
rm -f "$DATABASE_PATH"

echo ""
echo "===== Production Mode Security: PASSED ====="

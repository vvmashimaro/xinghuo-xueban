#!/bin/bash
# Test suite runner for Web registration flows

set -e

echo "=== Setting up test environment ==="

# Create test database copy
cp data/db.json data/db.test.json
echo "✓ Test database created"

# Set environment variables
export NODE_ENV=development
export SMS_PROVIDER=mock
export DATABASE_PATH="$(pwd)/data/db.test.json"
export PORT=8787

# Start API server in background
echo "Starting API server on port 8787..."
node src/index.js &
API_PID=$!
echo "✓ API server started (PID: $API_PID)"

# Wait for API to be ready
sleep 2

# Start static file server in background
echo "Starting static file server on port 8080..."
node static-server.js > /tmp/http-server.log 2>&1 &
HTTP_PID=$!
echo "✓ Static server started (PID: $HTTP_PID)"

# Go back to server directory
cd _platform/server

# Wait for server to be ready
sleep 2

echo ""
echo "=== Running test suite ==="
cd _platform/server

# Function to cleanup on exit
cleanup() {
  echo ""
  echo "=== Cleaning up ==="
  kill $API_PID 2>/dev/null || true
  kill $HTTP_PID 2>/dev/null || true
  rm -f data/db.test.json
  echo "✓ Cleanup complete"
}

trap cleanup EXIT INT TERM

# Run E2E tests
echo ""
node test-e2e-browser-improved.js

# Run additional auth tests
echo ""
echo "=== Running auth tests ==="
bash test-auth.sh

# Run miniprogram flow test
echo ""
echo "=== Running miniprogram flow test ==="
node test-miniprogram-flow.js

echo ""
echo "=== All tests complete ==="

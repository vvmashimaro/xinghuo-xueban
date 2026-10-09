#!/bin/bash
# Test suite runner for Web registration flows

set -e

echo "=== Setting up test environment ==="

# Record db.json state before tests
DB_BEFORE_HASH=$(git hash-object data/db.json 2>/dev/null || md5sum data/db.json | awk '{print $1}')

# Create test database copy
cp data/db.json data/db.test.json
echo "✓ Test database created"

# Set environment variables
export NODE_ENV=development
export SMS_PROVIDER=mock
export SMS_COOLDOWN_MS=0
export DATABASE_PATH="$(pwd)/data/db.test.json"
export PORT=8787

# Start API server in background
echo "Starting API server on port 8787..."
node src/index.js > /tmp/api-server.log 2>&1 &
API_PID=$!
echo "✓ API server started (PID: $API_PID)"

# Wait for API to be ready
sleep 2

# Start static file server in background
echo "Starting static file server on port 8080..."
node static-server.js > /tmp/http-server.log 2>&1 &
HTTP_PID=$!
echo "✓ Static server started (PID: $HTTP_PID)"

# Wait for servers to be ready
sleep 2

echo ""
echo "=== Running test suite ==="

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

echo ""
echo "=== Running pricing security tests ==="
node test-pricing-security.js

echo ""
echo "=== Running session PATCH security tests ==="
node test-session-patch-security.js

echo ""
echo "=== Running booking escrow hardening tests ==="
node test-booking-escrow-hardening.js

echo ""
echo "=== Running subjects / conflicts / booth tests ==="
node test-subjects-conflicts-booths.js

# Run miniprogram flow test
echo ""
echo "=== Running miniprogram flow test ==="
node test-miniprogram-flow.js

echo ""
echo "=== All tests complete ==="

# Verify db.json hasn't been modified by tests
echo ""
echo "=== Verifying db.json integrity ==="
DB_AFTER_HASH=$(git hash-object data/db.json 2>/dev/null || md5sum data/db.json | awk '{print $1}')

if [ "$DB_BEFORE_HASH" = "$DB_AFTER_HASH" ]; then
  echo "✓ db.json unchanged (tests used temp databases correctly)"
else
  echo "✗ ERROR: db.json was modified by tests!"
  echo "  Before: $DB_BEFORE_HASH"
  echo "  After:  $DB_AFTER_HASH"
  git diff --quiet -- data/db.json || {
    echo ""
    echo "Changes detected:"
    git diff data/db.json | head -50
  }
  exit 1
fi

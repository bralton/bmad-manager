#!/bin/bash
set -e

# Start Xvfb
Xvfb :99 -screen 0 1280x1024x24 &
XVFB_PID=$!
export DISPLAY=:99
echo "Xvfb started with PID: $XVFB_PID"
sleep 2

# Start tauri-driver
echo "Starting tauri-driver..."
tauri-driver &
DRIVER_PID=$!
echo "tauri-driver PID: $DRIVER_PID"
sleep 3

# Verify tauri-driver
curl -s http://127.0.0.1:4444/status || echo "Status check failed"

# Run E2E tests
SKIP_TAURI_DRIVER_SPAWN=true npm run test:e2e "$@"
EXIT_CODE=$?

# Cleanup
kill $DRIVER_PID 2>/dev/null || true
kill $XVFB_PID 2>/dev/null || true

exit $EXIT_CODE

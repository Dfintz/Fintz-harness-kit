#!/bin/bash
# K6 Load Testing Quick Start Script
# 
# This script helps run k6 load tests with proper configuration
# 
# Usage:
#   ./backend/tests/load-testing/quick-start.sh              # Run all tests with defaults
#   ./backend/tests/load-testing/quick-start.sh --vus 100    # Custom VUs
#   ./backend/tests/load-testing/quick-start.sh --auth-only  # Only auth tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
TOKEN="${TOKEN:-}"
ORG_ID="${ORG_ID:-org-test-$(date +%s)}"
VUS="${VUS:-10}"
DURATION="${DURATION:-2m}"
TEST_TYPE="${TEST_TYPE:-all}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --vus)
      VUS="$2"
      shift 2
      ;;
    --duration)
      DURATION="$2"
      shift 2
      ;;
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --org-id)
      ORG_ID="$2"
      shift 2
      ;;
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --auth-only)
      TEST_TYPE="auth"
      shift
      ;;
    --fleet-only)
      TEST_TYPE="fleet"
      shift
      ;;
    --activity-only)
      TEST_TYPE="activity"
      shift
      ;;
    --db-only)
      TEST_TYPE="db"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Function to print header
print_header() {
  echo -e "\n${GREEN}════════════════════════════════════════${NC}"
  echo -e "${GREEN}$1${NC}"
  echo -e "${GREEN}════════════════════════════════════════${NC}\n"
}

# Function to run test
run_test() {
  local test_file=$1
  local test_name=$2
  
  print_header "Running: $test_name"
  
  if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}⚠️  WARNING: No TOKEN provided. Using placeholder token.${NC}"
    echo -e "${YELLOW}To use real authentication, set TOKEN environment variable:${NC}"
    echo -e "${YELLOW}  export TOKEN=<your_jwt_token>${NC}\n"
  fi
  
  k6 run \
    --vus "$VUS" \
    --duration "$DURATION" \
    --env BASE_URL="$BASE_URL" \
    --env TOKEN="$TOKEN" \
    --env ORG_ID="$ORG_ID" \
    "$test_file"
  
  echo -e "\n${GREEN}✓ Test completed: $test_name${NC}\n"
}

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
  echo -e "${RED}✗ k6 is not installed!${NC}"
  echo -e "\nPlease install k6 from: https://k6.io/docs/getting-started/installation/"
  echo -e "  macOS:   brew install k6"
  echo -e "  Linux:   sudo apt-get install k6"
  echo -e "  Windows: choco install k6\n"
  exit 1
fi

# Check if backend is running
print_header "Pre-flight Checks"

echo "Checking backend availability at $BASE_URL..."
if ! curl -s -f "$BASE_URL/api/v2/health" > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  WARNING: Backend may not be running at $BASE_URL${NC}"
  echo -e "${YELLOW}Make sure backend is started: cd backend && npm run dev${NC}\n"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo -e "${GREEN}✓ k6 is installed${NC}"
echo -e "${GREEN}✓ Configuration:${NC}"
echo "  - Base URL: $BASE_URL"
echo "  - VUs: $VUS"
echo "  - Duration: $DURATION"
echo "  - Organization ID: $ORG_ID"
echo -e "  - Token: ${TOKEN:0:20}...${NC}\n"

# Get test directory
TEST_DIR="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"

# Run tests based on type
case "$TEST_TYPE" in
  auth)
    run_test "$TEST_DIR/01-authentication.js" "Authentication Tests"
    ;;
  fleet)
    run_test "$TEST_DIR/02-fleet-api.js" "Fleet API Tests"
    ;;
  activity)
    run_test "$TEST_DIR/03-activity-api.js" "Activity API Tests"
    ;;
  db)
    run_test "$TEST_DIR/05-database-performance.js" "Database Performance Tests"
    ;;
  all)
    run_test "$TEST_DIR/01-authentication.js" "Authentication Tests"
    sleep 2
    run_test "$TEST_DIR/02-fleet-api.js" "Fleet API Tests"
    sleep 2
    run_test "$TEST_DIR/03-activity-api.js" "Activity API Tests"
    sleep 2
    run_test "$TEST_DIR/05-database-performance.js" "Database Performance Tests"
    
    print_header "All Tests Completed"
    echo -e "${GREEN}Summary:${NC}"
    echo "  1. Authentication: Login, token refresh, 2FA, sessions"
    echo "  2. Fleet API: CRUD operations, ship assignments"
    echo "  3. Activity API: Activity management, filtering, RSVP"
    echo "  4. Database: Query performance, aggregations, search"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "  1. Review the metrics above for any threshold failures"
    echo "  2. Identify bottlenecks (slow endpoints, high error rates)"
    echo "  3. Check Application Insights for server-side metrics"
    echo "  4. Implement optimizations (caching, indexes, query optimization)"
    echo "  5. Re-run tests to measure improvement"
    ;;
  *)
    echo "Unknown test type: $TEST_TYPE"
    exit 1
    ;;
esac

print_header "Load Testing Complete!"
echo -e "${GREEN}For detailed metrics, check the output above.${NC}"
echo -e "${GREEN}For continuous monitoring, check Application Insights in Azure.${NC}\n"

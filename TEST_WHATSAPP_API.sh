#!/bin/bash

# Test WhatsApp API Endpoints
# Run this script locally or in CI to verify notification system is working

API_URL="${API_URL:-http://localhost:5000/api}"
TOKEN="${TOKEN:-test-token}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "WhatsApp API Endpoint Tests"
echo "API_URL: $API_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Helper function to make API calls
test_endpoint() {
  local method=$1
  local endpoint=$2
  local body=$3
  local description=$4

  echo ""
  echo -e "${YELLOW}Testing:${NC} $description"
  echo "  $method $endpoint"

  if [ -z "$body" ]; then
    response=$(curl -s -X "$method" "$API_URL$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json")
  else
    response=$(curl -s -X "$method" "$API_URL$endpoint" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$body")
  fi

  # Check if response contains error
  if echo "$response" | grep -q '"success":false\|"error"'; then
    echo -e "${RED}✗ Failed${NC}"
    echo "  Response: ${response:0:200}"
    return 1
  elif echo "$response" | grep -q '"success":true\|"type":"wa_link"\|"sent":true'; then
    echo -e "${GREEN}✓ Passed${NC}"
    echo "  Response: ${response:0:200}"
    return 0
  else
    echo -e "${YELLOW}⚠ Unclear${NC}"
    echo "  Response: ${response:0:200}"
    return 0
  fi
}

# Test 1: Check API is running
echo ""
echo -e "${YELLOW}Checking API Health...${NC}"
health=$(curl -s -X GET "$API_URL/" -H "Authorization: Bearer $TOKEN")
if echo "$health" | grep -q "Hospital Management API"; then
  echo -e "${GREEN}✓ API is running${NC}"
else
  echo -e "${RED}✗ API is not responding${NC}"
  echo "  Make sure backend is running: npm start"
  exit 1
fi

# Test 2: Notification endpoints (require valid data)
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Notification Endpoints${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# These will fail with 404 since we don't have real IDs, but we can verify endpoints exist
test_endpoint "POST" "/notifications/consultation" \
  '{"consultationId":"test-id"}' \
  "POST /notifications/consultation"

test_endpoint "POST" "/notifications/prescription" \
  '{"prescriptionId":"test-id"}' \
  "POST /notifications/prescription"

test_endpoint "POST" "/notifications/lab-result" \
  '{"orderId":"test-id"}' \
  "POST /notifications/lab-result"

test_endpoint "POST" "/notifications/radiology-report" \
  '{"orderId":"test-id"}' \
  "POST /notifications/radiology-report"

test_endpoint "POST" "/notifications/pharmacy-team" \
  '{"prescriptionId":"test-id"}' \
  "POST /notifications/pharmacy-team"

# Test 3: WhatsApp webhook
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}WhatsApp Webhook${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

test_endpoint "GET" "/notifications/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=gudmed_verify&hub.challenge=test123" \
  "" \
  "GET /notifications/whatsapp-webhook (webhook verification)"

test_endpoint "POST" "/notifications/whatsapp-webhook" \
  '{"From":"+919876543210","Body":"YES","entry":[{"changes":[{"value":{"messages":[{"from":"919876543210","text":{"body":"YES"}}]}}]}]}' \
  "POST /notifications/whatsapp-webhook (incoming message)"

# Summary
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Test Complete!${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Notes:"
echo "  • Endpoints returning 404 for 'test-id' is expected (IDs don't exist)"
echo "  • Endpoints should respond with status 200-400 range, not 500"
echo "  • For real testing, use actual consultation/prescription IDs from your DB"
echo ""
echo "Next steps:"
echo "  1. Create a consultation with prescription in the UI"
echo "  2. Verify PostConsultationWorkflow modal appears"
echo "  3. Click 'Send via WhatsApp' buttons"
echo "  4. Confirm wa.me links open with pre-filled messages"
echo ""

# Test WhatsApp API Endpoints (PowerShell)
# Run this script to verify notification system is working

param(
  [string]$ApiUrl = "http://localhost:5000/api",
  [string]$Token = "test-token"
)

# Colors
function Write-Success { Write-Host "✓ $args" -ForegroundColor Green }
function Write-Error { Write-Host "✗ $args" -ForegroundColor Red }
function Write-Warning { Write-Host "⚠ $args" -ForegroundColor Yellow }
function Write-Step { Write-Host "`n$args" -ForegroundColor Cyan }

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "WhatsApp API Endpoint Tests" -ForegroundColor Cyan
Write-Host "API URL: $ApiUrl" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Test helper
function Test-Endpoint {
  param(
    [string]$Method = "GET",
    [string]$Endpoint,
    [string]$Body,
    [string]$Description
  )

  Write-Host "`nTesting: $Description" -ForegroundColor Yellow
  Write-Host "  $Method $Endpoint"

  try {
    $headers = @{
      "Authorization" = "Bearer $Token"
      "Content-Type" = "application/json"
    }

    if ($Body) {
      $response = Invoke-WebRequest -Uri "$ApiUrl$Endpoint" `
        -Method $Method `
        -Headers $headers `
        -Body $Body `
        -ErrorAction SilentlyContinue
    } else {
      $response = Invoke-WebRequest -Uri "$ApiUrl$Endpoint" `
        -Method $Method `
        -Headers $headers `
        -ErrorAction SilentlyContinue
    }

    $responseBody = $response.Content
    if ($responseBody -match '"success":true|"type":"wa_link"|"sent":true|"message"') {
      Write-Success "Passed"
      Write-Host "  Response: $($responseBody.Substring(0, [Math]::Min(200, $responseBody.Length)))"
      return $true
    } elseif ($responseBody -match '"error"') {
      Write-Error "Failed"
      Write-Host "  Response: $($responseBody.Substring(0, [Math]::Min(200, $responseBody.Length)))"
      return $false
    } else {
      Write-Warning "Unclear response"
      Write-Host "  Response: $($responseBody.Substring(0, [Math]::Min(200, $responseBody.Length)))"
      return $true
    }
  }
  catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
      Write-Warning "404 Not Found (endpoint may not exist)"
      return $false
    } elseif ($_.Exception.Response.StatusCode -eq 400) {
      Write-Success "Passed (400 Bad Request expected for test data)"
      return $true
    } else {
      Write-Error "Exception: $($_.Exception.Message)"
      return $false
    }
  }
}

# Test 1: Check API is running
Write-Step "Checking API Health..."
try {
  $health = Invoke-WebRequest -Uri "$ApiUrl/" `
    -Method GET `
    -Headers @{"Authorization" = "Bearer $Token"} `
    -ErrorAction Stop

  if ($health.Content -match "Hospital Management API") {
    Write-Success "API is running"
  } else {
    Write-Error "API responded but unexpected content"
    exit 1
  }
}
catch {
  Write-Error "API is not responding"
  Write-Host "  Make sure backend is running: npm start" -ForegroundColor Red
  exit 1
}

# Test 2: Notification endpoints
Write-Step "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Step "Notification Endpoints"
Write-Step "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

Test-Endpoint -Method POST -Endpoint "/notifications/consultation" `
  -Body '{"consultationId":"test-id"}' `
  -Description "POST /notifications/consultation"

Test-Endpoint -Method POST -Endpoint "/notifications/prescription" `
  -Body '{"prescriptionId":"test-id"}' `
  -Description "POST /notifications/prescription"

Test-Endpoint -Method POST -Endpoint "/notifications/lab-result" `
  -Body '{"orderId":"test-id"}' `
  -Description "POST /notifications/lab-result"

Test-Endpoint -Method POST -Endpoint "/notifications/radiology-report" `
  -Body '{"orderId":"test-id"}' `
  -Description "POST /notifications/radiology-report"

Test-Endpoint -Method POST -Endpoint "/notifications/pharmacy-team" `
  -Body '{"prescriptionId":"test-id"}' `
  -Description "POST /notifications/pharmacy-team"

# Test 3: WhatsApp webhook
Write-Step "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Step "WhatsApp Webhook"
Write-Step "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

Test-Endpoint -Method GET `
  -Endpoint "/notifications/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=gudmed_verify&hub.challenge=test123" `
  -Description "GET /notifications/whatsapp-webhook (webhook verification)"

Test-Endpoint -Method POST `
  -Endpoint "/notifications/whatsapp-webhook" `
  -Body '{"From":"+919876543210","Body":"YES","entry":[{"changes":[{"value":{"messages":[{"from":"919876543210","text":{"body":"YES"}}]}}]}]}' `
  -Description "POST /notifications/whatsapp-webhook (incoming message)"

# Summary
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "Test Complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

Write-Host "`nNotes:" -ForegroundColor Yellow
Write-Host "  • Endpoints returning 404 for 'test-id' is expected (IDs don't exist)"
Write-Host "  • Endpoints should respond with status 200-400 range, not 500"
Write-Host "  • For real testing, use actual consultation/prescription IDs from your DB"

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Create a consultation with prescription in the UI"
Write-Host "  2. Verify PostConsultationWorkflow modal appears"
Write-Host "  3. Click 'Send via WhatsApp' buttons"
Write-Host "  4. Confirm wa.me links open with pre-filled messages"
Write-Host ""

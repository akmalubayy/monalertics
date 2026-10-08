try {
  $body = '{"content":"Test from PS script"}'
  $response = Invoke-RestMethod -Uri 'https://discord.com/api/webhooks/1554749315384352862/UwIN1OFwCI706WNlUOERWr0cTBYV9i7gBvqLHTbqC07cRjqYQ0HYw8Zx3Tpfbor3nKnq' -Method Post -ContentType 'application/json' -Body $body
  Write-Host "SUCCESS: $response"
} catch {
  Write-Host "FAILED: $($_.Exception.Message)"
  Write-Host "Response: $($_.Exception.Response)"
}
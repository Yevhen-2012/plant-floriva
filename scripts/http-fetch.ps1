$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
try {
  $migrationRequest = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $migrationUri = [Uri]$migrationRequest.url
  if ($migrationUri.Scheme -ne 'https') { throw 'HTTPS is required' }
  $migrationHeaders = @{}
  if ($migrationRequest.token) {
    if ($migrationUri.Host -ne 'api.webflow.com') { throw 'Credentials may only be sent to the Webflow API' }
    $migrationHeaders.Authorization = 'Bearer ' + $migrationRequest.token
  }
  if ($migrationRequest.output) {
    Invoke-WebRequest -Uri $migrationUri -Headers $migrationHeaders -UseBasicParsing -TimeoutSec 90 -OutFile $migrationRequest.output
    [Console]::Out.Write('{"saved":true}')
  } else {
    $migrationResponse = Invoke-WebRequest -Uri $migrationUri -Headers $migrationHeaders -UseBasicParsing -TimeoutSec 90
    [Console]::Out.Write($migrationResponse.Content)
  }
} catch {
  [Console]::Error.Write($_.Exception.Message)
  exit 1
}

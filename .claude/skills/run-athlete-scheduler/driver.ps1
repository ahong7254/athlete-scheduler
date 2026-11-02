# Drives athlete_schedule_v6_AH.html in headless Chrome via CDP (no node/python needed).
# Usage: powershell -File driver.ps1 [-Html file] [-Js "expr"] [-Shot out.png] [-Width 1400] [-Height 1000]
# Prints the JS expression's result (JSON) plus any uncaught page exceptions.
param(
  [string]$Html = "athlete_schedule_v6_AH.html",
  [string]$Js = "document.title",
  [string]$Shot = "",
  [int]$Width = 1400, [int]$Height = 1000,
  [int]$Port = 9333
)
$ErrorActionPreference = "Stop"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$url = ([System.Uri](Resolve-Path $Html).Path).AbsoluteUri
$prof = Join-Path $env:TEMP "athlete-driver-profile"
$p = Start-Process $chrome -PassThru -ArgumentList "--headless=new","--disable-gpu","--remote-debugging-port=$Port","--user-data-dir=$prof","--window-size=$Width,$Height","about:blank"
try {
  $tgt = $null
  for ($i=0; $i -lt 40 -and -not $tgt; $i++) {
    Start-Sleep -Milliseconds 250
    try { $tgt = (Invoke-RestMethod "http://127.0.0.1:$Port/json") | Where-Object type -eq "page" | Select-Object -First 1 } catch {}
  }
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ws.ConnectAsync([Uri]$tgt.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
  $script:id = 0
  function Send($method, $params = @{}) {
    $script:id++
    $msg = @{id=$script:id; method=$method; params=$params} | ConvertTo-Json -Depth 10 -Compress
    $b = [Text.Encoding]::UTF8.GetBytes($msg)
    $ws.SendAsync([ArraySegment[byte]]$b, 'Text', $true, [Threading.CancellationToken]::None).Wait()
    while ($true) {
      $sb = New-Object Text.StringBuilder
      do {
        $buf = New-Object byte[] 65536
        $r = $ws.ReceiveAsync([ArraySegment[byte]]$buf, [Threading.CancellationToken]::None).Result
        [void]$sb.Append([Text.Encoding]::UTF8.GetString($buf, 0, $r.Count))
      } until ($r.EndOfMessage)
      $o = $sb.ToString() | ConvertFrom-Json
      if ($o.method -eq "Runtime.exceptionThrown") { Write-Host "PAGE EXCEPTION: $($o.params.exceptionDetails.exception.description)" }
      if ($o.id -eq $script:id) { return $o }
    }
  }
  [void](Send "Runtime.enable"); [void](Send "Page.enable")
  [void](Send "Emulation.setDeviceMetricsOverride" @{width=$Width;height=$Height;deviceScaleFactor=1;mobile=$false})
  [void](Send "Page.navigate" @{url=$url})
  # wait for load + CDN LP solver
  for ($i=0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    $r = Send "Runtime.evaluate" @{expression="document.readyState==='complete' && typeof solver!=='undefined'"; returnByValue=$true}
    if ($r.result.result.value -eq $true) { break }
  }
  $r = Send "Runtime.evaluate" @{expression=$Js; returnByValue=$true; awaitPromise=$true}
  if ($r.result.exceptionDetails) { Write-Host "JS ERROR: $($r.result.exceptionDetails.exception.description)" }
  else { $r.result.result.value | ConvertTo-Json -Depth 6 }
  if ($Shot) {
    Start-Sleep -Milliseconds 500
    $s = Send "Page.captureScreenshot" @{format="png"}
    [IO.File]::WriteAllBytes($Shot, [Convert]::FromBase64String($s.result.data))
    Write-Host "screenshot: $Shot"
  }
} finally { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue; Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object CommandLine -like "*athlete-driver-profile*" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } }

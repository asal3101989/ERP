param(
  [Parameter(Mandatory=$true)][string]$JsonPath,
  [Parameter(Mandatory=$true)][string]$TemplatePath,
  [Parameter(Mandatory=$true)][string]$OutPdf,
  [Parameter(Mandatory=$false)][string]$TrackerType = 'po'
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $JsonPath)) { throw "JSON payload not found: $JsonPath" }
if (!(Test-Path -LiteralPath $TemplatePath)) { throw "Template not found: $TemplatePath" }

$data = Get-Content -LiteralPath $JsonPath -Raw | ConvertFrom-Json
$po = $data.po
$items = @($data.items)
$settings = $data.settings

$tmpXlsx = [System.IO.Path]::ChangeExtension($OutPdf, ".xlsx")
Copy-Item -LiteralPath $TemplatePath -Destination $tmpXlsx -Force

$excel = $null
$wb = $null
$ws = $null

function Set-ByLabel {
  param(
    [Parameter(Mandatory=$true)]$Sheet,
    [Parameter(Mandatory=$true)][string]$Label,
    [Parameter(Mandatory=$false)]$Value
  )
  $used = $Sheet.UsedRange
  $r1 = $used.Row
  $r2 = $r1 + $used.Rows.Count - 1
  $c1 = $used.Column
  $c2 = $c1 + $used.Columns.Count - 1
  for ($r = $r1; $r -le [Math]::Min($r2, 200); $r++) {
    for ($c = $c1; $c -le [Math]::Min($c2, 60); $c++) {
      $txt = [string]$Sheet.Cells.Item($r, $c).Text
      if ($txt -and $txt -match [regex]::Escape($Label)) {
        $Sheet.Cells.Item($r, $c + 1).Value2 = [string]$Value
        return $true
      }
    }
  }
  return $false
}

function Find-CellByPatterns {
  param(
    [Parameter(Mandatory=$true)]$Sheet,
    [Parameter(Mandatory=$true)][string[]]$Patterns
  )
  $used = $Sheet.UsedRange
  $r1 = $used.Row
  $r2 = $r1 + $used.Rows.Count - 1
  $c1 = $used.Column
  $c2 = $c1 + $used.Columns.Count - 1
  for ($r = $r1; $r -le [Math]::Min($r2, 260); $r++) {
    for ($c = $c1; $c -le [Math]::Min($c2, 80); $c++) {
      $txt = [string]$Sheet.Cells.Item($r, $c).Text
      if (-not [string]::IsNullOrWhiteSpace($txt)) {
        foreach ($p in $Patterns) {
          if ($txt -match $p) { return $Sheet.Cells.Item($r, $c) }
        }
      }
    }
  }
  return $null
}

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $wb = $excel.Workbooks.Open($tmpXlsx)
  try { $ws = $wb.Worksheets.Item("PO") } catch { $ws = $wb.Worksheets.Item(1) }

  # Update document title for WO
  if ($TrackerType -eq 'wo') {
    $ws.Cells.Item(2, 1).Value2 = "WORK ORDER"
  }

  # Header fields by label (best effort)
  Set-ByLabel -Sheet $ws -Label "PO No" -Value $po.po_number | Out-Null
  Set-ByLabel -Sheet $ws -Label "Date" -Value $po.po_date | Out-Null
  Set-ByLabel -Sheet $ws -Label "PO Req No" -Value $po.po_req_no | Out-Null
  Set-ByLabel -Sheet $ws -Label "PO Req Date" -Value $po.po_req_date | Out-Null
  Set-ByLabel -Sheet $ws -Label "Approval No" -Value $po.approval_no | Out-Null
  Set-ByLabel -Sheet $ws -Label "Project" -Value $po.site_code | Out-Null

  Set-ByLabel -Sheet $ws -Label "To" -Value $po.vendor | Out-Null
  Set-ByLabel -Sheet $ws -Label "Delivery Address" -Value $po.delivery_address | Out-Null
  Set-ByLabel -Sheet $ws -Label "Contact Person" -Value $po.delivery_contact | Out-Null
  $narrationValue = ""
  if ($null -ne $po.narration -and [string]$po.narration -ne "") { $narrationValue = [string]$po.narration }
  elseif ($null -ne $po.description -and [string]$po.description -ne "") { $narrationValue = [string]$po.description }
  Set-ByLabel -Sheet $ws -Label "Narration" -Value $narrationValue | Out-Null

  # Fixed mapping for provided PO template (sheet "PO")
  # Item header row is 20, item lines are rows 22..32.
  $col = @{ sl=1; desc=2; uom=4; qty=5; rate=6; amount=7; heads=8 }
  $startRow = 22
  $maxRows = 11

  # Clear old rows in template area
  for ($rr = $startRow; $rr -lt ($startRow + $maxRows); $rr++) {
    foreach ($k in $col.Keys) {
      $ws.Cells.Item($rr, $col[$k]).Value2 = $null
    }
  }

  # Fill PO items
  $idx = 0
  foreach ($it in $items) {
    if ($idx -ge $maxRows) { break }
    $row = $startRow + $idx
    $qty = [double]($it.quantity | ForEach-Object { if ($_ -eq $null -or $_ -eq '') { 0 } else { $_ } })
    $rate = [double]($it.rate | ForEach-Object { if ($_ -eq $null -or $_ -eq '') { 0 } else { $_ } })
    $amount = [double]($it.amount | ForEach-Object { if ($_ -eq $null -or $_ -eq '') { $qty * $rate } else { $_ } })

    $ws.Cells.Item($row, $col["sl"]).Value2 = $idx + 1
    $ws.Cells.Item($row, $col["desc"]).Value2 = [string]$it.description
    $ws.Cells.Item($row, $col["uom"]).Value2 = [string]$it.uom
    $ws.Cells.Item($row, $col["qty"]).Value2 = $qty
    $ws.Cells.Item($row, $col["rate"]).Value2 = $rate
    $ws.Cells.Item($row, $col["amount"]).Value2 = $amount
    $ws.Cells.Item($row, $col["heads"]).Value2 = [string]$it.heads

    $idx++
  }

  # Totals from source data
  $subTotal = 0.0
  $gstTotal = 0.0
  $grand = 0.0
  foreach ($it in $items) {
    $qty = [double]($it.quantity | ForEach-Object { if ($_ -eq $null -or $_ -eq '') { 0 } else { $_ } })
    $rate = [double]($it.rate | ForEach-Object { if ($_ -eq $null -or $_ -eq '') { 0 } else { $_ } })
    $basic = [double]($it.amount | ForEach-Object { if ($_ -eq $null -or $_ -eq '') { $qty * $rate } else { $_ } })
    $gstPct = [double]($it.gst_pct | ForEach-Object { if ($_ -eq $null -or $_ -eq '') { 0 } else { $_ } })
    $gstAmt = [double]($it.gst_amt | ForEach-Object { if ($_ -eq $null -or $_ -eq '') { [math]::Round($basic * $gstPct / 100, 2) } else { $_ } })
    $total = [double]($it.total_amt | ForEach-Object { if ($_ -eq $null -or $_ -eq '') { $basic + $gstAmt } else { $_ } })
    $subTotal += $basic
    $gstTotal += $gstAmt
    $grand += $total
  }
  Set-ByLabel -Sheet $ws -Label "Sub Total" -Value ([math]::Round($subTotal,2)) | Out-Null
  Set-ByLabel -Sheet $ws -Label "GST Total" -Value ([math]::Round($gstTotal,2)) | Out-Null
  Set-ByLabel -Sheet $ws -Label "Grand Total" -Value ([math]::Round($grand,2)) | Out-Null

  # Rupees in words — write to A38 (empty row between Grand Total and template content)
  $rupeesText = [string]$data.rupees_text
  if ([string]::IsNullOrWhiteSpace($rupeesText)) {
    $rupeesText = "Rupees: " + ([math]::Round($grand,2)).ToString("N2") + " Only."
  }
  $ws.Range("A38").Value2 = $rupeesText

  # Keep Terms & Conditions rows (44 onwards) from template as-is.

  # Set explicit print area so Excel doesn't shrink due to distant formatted cells.
  $ws.PageSetup.PrintArea = "A1:I72"

  # Use stable scaling for readability.
  $ws.PageSetup.Zoom = 90
  $ws.PageSetup.FitToPagesWide = $false
  $ws.PageSetup.FitToPagesTall = $false

  $wb.Save()
  $xlTypePDF = 0
  $wb.ExportAsFixedFormat($xlTypePDF, $OutPdf)
}
finally {
  if ($wb -ne $null) { try { $wb.Close($false) } catch {} }
  if ($excel -ne $null) {
    try { $excel.Quit() } catch {}
    try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ws) | Out-Null } catch {}
    try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) | Out-Null } catch {}
    try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null } catch {}
  }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
  if (Test-Path -LiteralPath $tmpXlsx) { Remove-Item -LiteralPath $tmpXlsx -Force -ErrorAction SilentlyContinue }
}

if (!(Test-Path -LiteralPath $OutPdf)) {
  throw "Excel did not generate PDF."
}

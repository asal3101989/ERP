$base = 'H:\OFFICE PROJECTS\consrpro\construct-erp\frontend\src\pages'
$files = @(
  'quality\NCRPage.jsx',
  'quality\LabTestPage.jsx',
  'quality\DocumentControlPage.jsx',
  'quality\ChecklistTemplatePage.jsx',
  'hse\HSEDashboard.jsx',
  'hse\IncidentPage.jsx',
  'hse\PermitPage.jsx',
  'hse\PPEPage.jsx',
  'finance\VendorInvoicePage.jsx',
  'finance\BillBookingPage.jsx',
  'hr\WorkerList.jsx',
  'hr\PayrollPage.jsx'
)

foreach ($f in $files) {
  $p = Join-Path $base $f
  if (Test-Path $p) {
    $c = Get-Content $p -Raw -Encoding UTF8
    # Replace dark page backgrounds
    $c = $c -replace 'bg-slate-950 min-h-screen', 'bg-slate-50 min-h-screen'
    # Replace dark card backgrounds
    $c = $c -replace 'card-lg border border-slate-800 bg-slate-900/40', 'card-lg border border-slate-200 bg-white shadow-sm'
    $c = $c -replace 'bg-slate-900/40 border border-slate-800', 'bg-white border border-slate-200 shadow-sm'
    $c = $c -replace 'bg-slate-900/50 border border-slate-800', 'bg-white border border-slate-200 shadow-sm'
    $c = $c -replace 'bg-slate-900 border border-slate-800', 'bg-white border border-slate-200 shadow-sm'
    # Replace dark table headers
    $c = $c -replace 'bg-slate-950/80 border-b border-slate-800', 'bg-slate-50 border-b border-slate-200'
    $c = $c -replace 'divide-y divide-slate-800/50', 'divide-y divide-slate-100'
    $c = $c -replace 'divide-y divide-slate-800', 'divide-y divide-slate-100'
    $c = $c -replace 'hover:bg-slate-800/40', 'hover:bg-slate-50'
    # Replace dark modal overlays
    $c = $c -replace 'bg-slate-950/90 backdrop-blur-xl', 'bg-slate-900/40 backdrop-blur-md'
    $c = $c -replace 'bg-slate-950/80 backdrop-blur-md', 'bg-slate-900/40 backdrop-blur-md'
    # Replace dark modal containers
    $c = $c -replace 'bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-\[2\.5rem\]', 'bg-white border border-slate-200 w-full max-w-2xl rounded-[2.5rem]'
    $c = $c -replace 'bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-\[3rem\]', 'bg-white border border-slate-200 w-full max-w-4xl rounded-[3rem]'
    # Replace dark modal headers
    $c = $c -replace 'p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50', 'p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50'
    # Replace dark text in headings
    $c = $c -replace 'text-slate-100 uppercase tracking-tight italic', 'text-slate-900 uppercase tracking-tight italic'
    $c = $c -replace 'text-2xl font-black text-slate-100 uppercase', 'text-2xl font-black text-slate-900 uppercase'
    $c = $c -replace 'text-xl font-black text-slate-100 uppercase', 'text-xl font-black text-slate-900 uppercase'
    $c = $c -replace 'text-white font-black uppercase text-sm', 'text-slate-900 font-black uppercase text-sm'
    # Replace dark action buttons
    $c = $c -replace 'bg-slate-950 text-slate-500 hover:text-white border border-slate-800', 'bg-white text-slate-500 hover:text-indigo-600 border border-slate-200 shadow-sm'
    # Replace dark input backgrounds
    $c = $c -replace 'bg-slate-950 border-white/5"', 'bg-white border-slate-200"'
    $c = $c -replace "bg-slate-950 border-white/5'", "bg-white border-slate-200'"
    # Replace dark info boxes
    $c = $c -replace 'bg-slate-950 p-6 rounded-3xl border border-white/5', 'bg-slate-50 p-6 rounded-3xl border border-slate-200'

    [System.IO.File]::WriteAllText($p, $c, [System.Text.Encoding]::UTF8)
    Write-Host "Fixed: $f"
  } else {
    Write-Host "NOT FOUND: $f"
  }
}
Write-Host "Done."

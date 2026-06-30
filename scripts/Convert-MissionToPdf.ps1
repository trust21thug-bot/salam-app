param(
  [Parameter(Mandatory=$true)][string]$TemplatePath,
  [Parameter(Mandatory=$true)][string]$OutputPdfPath,
  [string]$ManagerName = "",
  [string]$Destination = "",
  [string]$TripDate = "",
  [string]$PrintDate = ""
)

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  $doc = $word.Documents.Open($TemplatePath, $false, $true)

  # Find and replace placeholders using raw search (avoid Arabic in hash)
  function Replace-Text($findText, $replaceText) {
    $find = $word.Selection.Find
    $find.ClearFormatting()
    $find.Replacement.ClearFormatting()
    $find.Text = $findText
    $find.Replacement.Text = $replaceText
    $find.Forward = $true
    $find.Wrap = 1
    $find.Format = $false
    $find.MatchCase = $false
    $find.MatchWholeWord = $false
    $find.Execute($null, $null, $null, $null, $null, $null, $null, $null, $null, $null, 2)
  }

  Replace-Text ([char]0x0645][char]0x062F][char]0x064A][char]0x0631] [char]0x0627][char]0x0644][char]0x0631][char]0x062D][char]0x0644][char]0x0629) ($ManagerName)
  Replace-Text ([char]0x0627][char]0x0644][char]0x0648][char]0x062C][char]0x0647][char]0x0629) ($Destination)
  Replace-Text ([char]0x062A][char]0x0627][char]0x0631][char]0x064A][char]0x062E] [char]0x0627][char]0x0644][char]0x0631][char]0x062D][char]0x0644][char]0x0629) ($TripDate)
  Replace-Text ([char]0x064A][char]0x0648][char]0x0645] [char]0x0627][char]0x0644][char]0x0637][char]0x0628][char]0x0627][char]0x0639][char]0x0629) ($PrintDate)

  # Save as PDF (17 = wdFormatPDF)
  $doc.SaveAs([string]$OutputPdfPath, 17)
  $doc.Close()
  $word.Quit()

  Write-Host "OK:$OutputPdfPath"
  exit 0
}
catch {
  Write-Host "ERROR:$($_.Exception.Message)"
  if ($word) { try { $word.Quit() } catch {} }
  exit 1
}
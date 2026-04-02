$patterns = @{
  '../../../theme' = '../../theme'
  '../../../state/useStore' = '../../state/useStore'
  '../../../components/' = '../../components/'
  '../../../data' = '../../data'
  '../../../social' = '../../social'
  '../../../mockEvents' = '../../mockEvents'
  '../../../supabase' = '../../supabase'
}

$files = Get-ChildItem -Path 'src/screens' -Recurse -Filter *.js

foreach ($file in $files) {
  $content = Get-Content -Path $file.FullName -Raw
  $updated = $content

  foreach ($pattern in $patterns.Keys) {
    $escaped = [regex]::Escape($pattern)
    $replacement = $patterns[$pattern]
    $updated = $updated -replace $escaped, $replacement
  }

  if ($updated -ne $content) {
    Set-Content -Path $file.FullName -Value $updated
    Write-Output "Updated: $($file.FullName)"
  }
}

<#
.SYNOPSIS
  Regenera .claude/ a partir de .agents/ (la fuente de verdad).

.DESCRIPTION
  Copia en lugar de usar enlaces simbólicos para que funcione en Windows sin
  modo desarrollador ni core.symlinks.

    .agents/agents/<n>.agent.md            -> .claude/agents/<n>.md
    .agents/prompts/<n>.md                 -> .claude/commands/<n>.md
    .agents/skills/<skill>/                -> .claude/skills/<skill>/
    .agents/instructions/<n>.instructions.md -> .claude/rules/<n>.md

  No toca .claude/settings.json ni .claude/settings.local.json.

.EXAMPLE
  ./scripts/sync-claude.ps1
#>
$ErrorActionPreference = 'Stop'

$root   = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root '.agents'
$target = Join-Path $root '.claude'

if (-not (Test-Path $source)) { throw "No existe $source" }

$generated = 'agents', 'commands', 'skills', 'rules'
foreach ($dir in $generated) {
  $path = Join-Path $target $dir
  if (Test-Path $path) { Remove-Item $path -Recurse -Force }
  New-Item -ItemType Directory -Path $path -Force | Out-Null
}

Get-ChildItem (Join-Path $source 'agents') -Filter '*.agent.md' | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $target "agents/$($_.Name -replace '\.agent\.md$', '.md')")
}

Get-ChildItem (Join-Path $source 'prompts') -Filter '*.md' | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $target "commands/$($_.Name)")
}

Get-ChildItem (Join-Path $source 'skills') -Directory | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $target 'skills') -Recurse
}

Get-ChildItem (Join-Path $source 'instructions') -Filter '*.instructions.md' | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $target "rules/$($_.Name -replace '\.instructions\.md$', '.md')")
}

$counts = $generated | ForEach-Object {
  "$_=$((Get-ChildItem (Join-Path $target $_) -Recurse -File).Count)"
}
Write-Output "Sincronizado .agents -> .claude ($($counts -join ', '))"

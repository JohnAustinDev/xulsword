# Run on the Windows VM by package-winvm-appx.mjs, from the project folder it
# copied there. Makes one .appx per architecture from the prepackaged apps,
# in the project's 'out' folder.
#
# -BuilderVersion  electron-builder version to use (the same as on Linux)
# -Archs           comma separated arch:unpacked-dir pairs, for example
#                  x64:win-unpacked,ia32:win-ia32-unpacked

param(
  [Parameter(Mandatory = $true)][string]$BuilderVersion,
  [Parameter(Mandatory = $true)][string]$Archs
)
$ErrorActionPreference = 'Stop'

$project = $PSScriptRoot

# electron-builder is installed next to the project folder, so it is kept
# between runs.
$tools = Join-Path (Split-Path $project) 'tools'
$builderPkg = Join-Path $tools 'node_modules\electron-builder\package.json'
if (
  !(Test-Path $builderPkg) -or
  (Get-Content $builderPkg -Raw | ConvertFrom-Json).version -ne $BuilderVersion
) {
  New-Item -ItemType Directory -Force $tools | Out-Null
  # No install scripts: electron-builder needs none, and the optional
  # electron-winstaller script fails with a 32 bit Node.
  npm install --prefix $tools --no-audit --no-fund --ignore-scripts "electron-builder@$BuilderVersion"
  if ($LASTEXITCODE) { throw 'npm install of electron-builder failed' }
}
$cli = Join-Path $tools 'node_modules\electron-builder\cli.js'

foreach ($pair in $Archs.Split(',')) {
  $arch, $dir = $pair.Split(':')
  node $cli build `
    --projectDir $project `
    --config (Join-Path $project 'electron-builder.json') `
    --prepackaged (Join-Path $project $dir) `
    --win appx "--$arch" `
    --publish never
  if ($LASTEXITCODE) { throw "electron-builder failed for $arch" }
}

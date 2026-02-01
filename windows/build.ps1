# build.ps1 - Creates a portable Windows package for homescreen-hero
# Run from the windows/ folder: .\build.ps1

param(
    [string]$PythonVersion = "3.11.9",
    [string]$OutputDir = ".\dist\homescreen-hero-portable",
    [switch]$SkipFrontend,
    [switch]$CreateZip
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Get-Item "$PSScriptRoot\..").FullName

Write-Host "`n=== Building homescreen-hero portable package ===" -ForegroundColor Cyan
Write-Host "Python version: $PythonVersion"
Write-Host "Output: $OutputDir`n"

# Clean and create output directory
if (Test-Path $OutputDir) {
    Write-Host "Cleaning existing output directory..."
    Remove-Item -Recurse -Force $OutputDir
}
New-Item -ItemType Directory -Path $OutputDir | Out-Null
New-Item -ItemType Directory -Path "$OutputDir\python" | Out-Null
New-Item -ItemType Directory -Path "$OutputDir\app" | Out-Null
New-Item -ItemType Directory -Path "$OutputDir\data" | Out-Null

# Download embedded Python
$pythonZip = "python-$PythonVersion-embed-amd64.zip"
$pythonUrl = "https://www.python.org/ftp/python/$PythonVersion/$pythonZip"
$pythonDownload = "$PSScriptRoot\$pythonZip"

if (-not (Test-Path $pythonDownload)) {
    Write-Host "Downloading embedded Python $PythonVersion..."
    Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonDownload
} else {
    Write-Host "Using cached Python download..."
}

Write-Host "Extracting Python..."
Expand-Archive -Path $pythonDownload -DestinationPath "$OutputDir\python" -Force

# Enable site-packages by modifying python311._pth (or similar)
$pthFile = Get-ChildItem "$OutputDir\python\python*._pth" | Select-Object -First 1
if ($pthFile) {
    Write-Host "Enabling site-packages in $($pthFile.Name)..."
    $content = Get-Content $pthFile.FullName
    $content = $content -replace '#import site', 'import site'
    Set-Content -Path $pthFile.FullName -Value $content
}

# Install pip
Write-Host "Installing pip..."
$getPipUrl = "https://bootstrap.pypa.io/get-pip.py"
$getPipPath = "$PSScriptRoot\get-pip.py"
if (-not (Test-Path $getPipPath)) {
    Invoke-WebRequest -Uri $getPipUrl -OutFile $getPipPath
}
& "$OutputDir\python\python.exe" $getPipPath --no-warn-script-location

# Install dependencies
Write-Host "Installing Python dependencies..."
$requirementsPath = "$RepoRoot\homescreen_hero\requirements.txt"
& "$OutputDir\python\python.exe" -m pip install -r $requirementsPath --no-warn-script-location

# Copy backend code
Write-Host "Copying backend code..."
Copy-Item -Recurse "$RepoRoot\homescreen_hero" "$OutputDir\app\homescreen_hero"

# Remove unnecessary files from backend
Remove-Item -Recurse -Force "$OutputDir\app\homescreen_hero\.venv" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$OutputDir\app\homescreen_hero\tests" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$OutputDir\app\homescreen_hero\__pycache__" -ErrorAction SilentlyContinue
Get-ChildItem -Recurse "$OutputDir\app" -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force

# Build and copy frontend
if (-not $SkipFrontend) {
    Write-Host "Building frontend..."
    Push-Location "$RepoRoot\homescreen-hero-ui"
    npm install
    npm run build
    Pop-Location

    Write-Host "Copying frontend build..."
    $frontendDest = "$OutputDir\app\homescreen_hero\web\frontend"
    if (Test-Path $frontendDest) {
        Remove-Item -Recurse -Force $frontendDest
    }
    Copy-Item -Recurse "$RepoRoot\homescreen-hero-ui\dist" $frontendDest
}

# Copy start script, launcher, version file, and example config
Write-Host "Copying launcher and config..."
Copy-Item "$PSScriptRoot\start.bat" "$OutputDir\start.bat"
Copy-Item "$PSScriptRoot\launcher.py" "$OutputDir\launcher.py"
Copy-Item "$RepoRoot\VERSION" "$OutputDir\VERSION"
Copy-Item "$RepoRoot\example.config.yaml" "$OutputDir\data\config.yaml"
Copy-Item "$RepoRoot\.env.example" "$OutputDir\.env.example" -ErrorAction SilentlyContinue

# Create README
$readmeContent = @"
# homescreen-hero (Windows Portable)

A self-hosted Plex companion app that automatically rotates collections on your homescreen.

## Quick Start

1. GET YOUR PLEX TOKEN
   - Go to any media item in Plex Web, click (...) > Get Info > View XML
   - Copy the "X-Plex-Token" value from the URL

2. CONFIGURE THE APP
   - Open `data\config.yaml` in a text editor (Notepad works fine)
   - Set your Plex server URL (e.g., http://192.168.1.100:32400)
   - Paste your Plex token
   - Save the file

3. RUN THE APP
   - Double-click `start.bat`
   - A console window will open - keep it running
   - Open http://localhost:8000 in your browser

4. SET UP YOUR FIRST ROTATION
   - Complete the setup wizard in the web UI
   - Create a group and add some collections
   - Set your rotation schedule

That's it! The app will now automatically rotate your Plex homescreen collections.

## Files

- `start.bat` - Double-click to run the app
- `data\` - Your config, database, and logs (keep this when updating!)
- `python\` - Embedded Python (don't modify)
- `app\` - Application code (don't modify)
- `.env.example` - Example environment variables (optional)

## Changing the Port

By default, the app runs on port 8000. To change it:

1. Create a new file called `.env` in this folder (no filename, just .env)
   - In Notepad: Save As > filename: ".env" (with quotes) > Save as type: All Files
2. Add this line: HSH_PORT=9000
3. Save and restart the app

## Running at Startup

To have homescreen-hero start automatically with Windows:

1. Press Win+R, type `shell:startup`, press Enter
2. Right-click in the folder > New > Shortcut
3. Browse to `start.bat` in this folder
4. Click Next, name it "homescreen-hero", click Finish

Note: The console window will be visible. For a hidden background service,
look into Task Scheduler or NSSM (nssm.cc).

## Updating

1. Download the latest portable release
2. Extract it to a new folder
3. Copy your `data\` folder from the old version to the new one
4. Run `start.bat` in the new folder

Your configuration, database, and history will be preserved.

## Troubleshooting

- "Port already in use" - Another app is using port 8000. Change the port (see above).
- Can't connect to Plex - Check your Plex URL includes the port (usually :32400)
- Token not working - Make sure you copied the full token, no extra spaces

For more help, visit: https://github.com/trentferguson/homescreen-hero
"@
Set-Content -Path "$OutputDir\README.txt" -Value $readmeContent

# Create ZIP if requested
if ($CreateZip) {
    $zipPath = "$PSScriptRoot\dist\homescreen-hero-portable.zip"
    Write-Host "Creating ZIP archive..."
    if (Test-Path $zipPath) {
        Remove-Item $zipPath
    }
    Compress-Archive -Path "$OutputDir\*" -DestinationPath $zipPath
    Write-Host "Created: $zipPath"
}

Write-Host "`n=== Build complete! ===" -ForegroundColor Green
Write-Host "Output: $OutputDir"
Write-Host "To test: cd `"$OutputDir`" && .\start.bat`n"

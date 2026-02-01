# Windows Portable Build

Scripts to create a standalone Windows package that doesn't require Python or Node.js to be installed.

## Building the Package

From PowerShell in this folder:

```powershell
.\build.ps1
```

This will:
1. Download embedded Python (~15MB, cached for future builds)
2. Install all pip dependencies into it
3. Build the React frontend
4. Package everything into `dist\homescreen-hero-portable\`

### Options

```powershell
# Skip frontend build (if you already built it)
.\build.ps1 -SkipFrontend

# Create a ZIP file for distribution
.\build.ps1 -CreateZip

# Use a different Python version
.\build.ps1 -PythonVersion "3.12.4"
```

## Testing

After building:

```powershell
cd dist\homescreen-hero-portable
.\start.bat
```

## Output Structure

```
homescreen-hero-portable/
├── start.bat           # Double-click to run
├── README.txt          # User instructions
├── python/             # Embedded Python + dependencies
├── app/
│   └── homescreen_hero/  # Backend + frontend
└── data/
    └── config.yaml     # User config (from example)
```

## Notes

- The embedded Python download is cached in this folder (`python-*.zip`)
- `get-pip.py` is also cached after first download
- The `.venv` and `tests` folders are excluded from the package to save space

@echo off
setlocal

:: Get the directory where this script lives
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

:: Set up paths
set "PYTHON=%ROOT%\python\python.exe"

echo.
echo ========================================
echo   homescreen-hero
echo ========================================
echo.
echo Starting server at http://localhost:8000
echo Press Ctrl+C to stop
echo.

:: Run the launcher script
"%PYTHON%" "%ROOT%\launcher.py"

pause
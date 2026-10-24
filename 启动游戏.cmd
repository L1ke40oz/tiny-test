@echo off
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  start "" "%~dp0index.html"
  exit /b
)
start "" "http://127.0.0.1:4404"
python -m http.server 4404 --bind 127.0.0.1
pause

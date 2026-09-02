@echo off
echo Stopping Invoice server on port 3000...

:: Kill processes listening on port 3000 (with /T to kill entire process tree)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /T /PID %%a >nul 2>&1
)

:: Remove stale Next.js dev lock file if present
if exist ".next\dev\lock" (
    del /f /q ".next\dev\lock" >nul 2>&1
)

echo Invoice server stopped and lock cleared.

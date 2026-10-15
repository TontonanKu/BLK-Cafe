@echo off
cd /d "%~dp0"
echo Installing project dependencies (first run only)...
call npm install
if errorlevel 1 pause & exit /b 1
call npm start
pause

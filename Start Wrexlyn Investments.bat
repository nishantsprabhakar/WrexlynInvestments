@echo off
title Wrexlyn for Investments
cd /d "%~dp0"
start "Wrexlyn for Investments Server" /min cmd /c "node dist\server\index.js"
timeout /t 2 /nobreak >nul
start "" http://localhost:4500/

@echo off
chcp 65001 >nul
title RINQ SHOP - Chay dong thoi Web + Bot
cls
echo ========================================================
echo       RINQ SHOP - CHAY DONG THOI WEB VA TELEGRAM BOT
echo ========================================================
echo.
cd /d "%~dp0"
call npm run dev:all
pause

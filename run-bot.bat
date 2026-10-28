@echo off
chcp 65001 >nul
title RINQ SHOP - Telegram Bot
cls
echo ========================================================
echo          RINQ SHOP - KHOI DONG TELEGRAM BOT
echo ========================================================
echo.
echo [*] Dang khoi chay Telegram Bot...
echo [*] Khi Bot mo, he thong Web Storefront se tu dong duoc mo khoa.
echo.
cd /d "%~dp0"
call npm run bot
pause

@echo off
chcp 65001 >nul
title RINQ SHOP - Web Storefront
cls
echo ========================================================
echo          RINQ SHOP - KHOI DONG WEB STOREFRONT
echo ========================================================
echo.
echo [*] Dang khoi dong Web Server Next.js (http://localhost:3000)...
echo [*] Luu y: Phai mo ca "run-bot.bat" de Web hoat dong!
echo.
cd /d "%~dp0"
call npm run dev
pause

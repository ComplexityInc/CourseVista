@echo off
setlocal
cd /d "%~dp0"

echo.
echo   CourseVista - publish
echo   ---------------------
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo   Git is not installed.
  echo   Get it from https://git-scm.com/download/win then run this again.
  echo.
  pause
  exit /b 1
)

if not exist ".git" (
  echo   First run - setting up the repository...
  git init -b main
  git remote add origin https://github.com/ComplexityInc/CourseVista.git
)

git add -A

git diff --cached --quiet
if not errorlevel 1 (
  echo   Nothing has changed since the last publish.
  echo.
  pause
  exit /b 0
)

set MSG=%*
if "%MSG%"=="" set MSG=Update site

git commit -m "%MSG%"
git push -u origin main

if errorlevel 1 (
  echo.
  echo   Push failed. If the repo already has files in it, run:
  echo      git pull --rebase origin main
  echo   then double-click this file again.
  echo.
  pause
  exit /b 1
)

echo.
echo   Published. Vercel will redeploy in about a minute.
echo.
pause

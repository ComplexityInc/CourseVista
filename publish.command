#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo
echo "  CourseVista — publish"
echo "  ---------------------"
echo

if ! command -v git >/dev/null 2>&1; then
  echo "  Git is not installed. Install it, then run this again."
  exit 1
fi

if [ ! -d .git ]; then
  echo "  First run — setting up the repository..."
  git init -b main
  git remote add origin https://github.com/ComplexityInc/CourseVista.git
fi

git add -A

if git diff --cached --quiet; then
  echo "  Nothing has changed since the last publish."
  exit 0
fi

git commit -m "${1:-Update site}"
git push -u origin main

echo
echo "  Published. Vercel will redeploy in about a minute."

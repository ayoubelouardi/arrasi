#!/bin/bash
# Quick status check for project

echo "=== Project Status ==="
echo "Branch: $(git branch --show-current)"
echo "Status: $(git status --short)"
echo ""
echo "Recent commits:"
git log --oneline -5

#!/bin/bash
# List all git worktrees

WORKTREE_DIR="$(git rev-parse --show-toplevel)/worktrees"

if [ -d "$WORKTREE_DIR" ]; then
    echo "Worktrees:"
    for wt in "$WORKTREE_DIR"/*; do
        [ -d "$wt" ] && echo "  - $(basename "$wt")"
    done
else
    echo "No worktrees directory found"
fi

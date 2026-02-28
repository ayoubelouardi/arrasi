#!/bin/bash
# Open docs in preferred editor

DOCS_DIR="$(git rev-parse --show-toplevel)/docs"

if [ -z "$1" ]; then
    echo "Usage: $0 <doc-name>"
    echo "Available docs:"
    ls "$DOCS_DIR"
    exit 1
fi

"$EDITOR" "$DOCS_DIR/$1"

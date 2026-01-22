#!/bin/bash
# Clean Mac resource fork files before deployment
# Run this if you're deploying from a Mac

set -e

echo "Cleaning Mac resource fork files..."
find . -name "._*" -type f -delete 2>/dev/null || true
find . -name ".DS_Store" -type f -delete 2>/dev/null || true
echo "Done! Removed all ._* and .DS_Store files"

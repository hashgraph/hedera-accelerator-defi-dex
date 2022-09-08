#!/bin/sh
# Change to the correct directory
cd /app;

# Keep node alive
set -e
echo "Display context "
echo ${{ env.COMMIT_MESSAGE }}


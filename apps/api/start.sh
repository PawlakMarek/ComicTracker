#!/bin/sh
set -e

echo "Running migrations..."
if ! npm run prisma:deploy; then
  echo "Migrations failed; starting API anyway."
fi

node dist/index.js

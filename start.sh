#!/bin/sh
set -e

DB_FILE="/data/app.db"

if [ ! -f "$DB_FILE" ]; then
  echo "First run: creating database and applying schema..."
  npx prisma db push --skip-generate
  echo "Seeding database..."
  npx tsx --tsconfig tsconfig.json prisma/seed.ts
else
  # Apply any pending schema changes (runs fast if already in sync)
  npx prisma db push --skip-generate &
fi

# Start the app
HOSTNAME=0.0.0.0 PORT=3000 node server.js

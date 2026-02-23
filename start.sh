#!/bin/sh
set -e

# Apply schema to the SQLite DB on the persistent volume
npx prisma db push --skip-generate

# Seed if the database has no users (first deploy)
NEEDS_SEED=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.user.count().then(c => { console.log(c === 0 ? 'yes' : 'no'); p.\$disconnect(); });
")

if [ "$NEEDS_SEED" = "yes" ]; then
  echo "Seeding database..."
  npx tsx --tsconfig tsconfig.json prisma/seed.ts
fi

# Start the app
node server.js

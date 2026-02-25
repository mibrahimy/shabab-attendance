#!/bin/sh
set -e

DB_FILE="/data/app.db"
SCHEMA_HASH_FILE="/data/.schema_hash"

# Get current schema hash
CURRENT_HASH=$(md5sum prisma/schema.prisma | cut -d' ' -f1)

if [ ! -f "$DB_FILE" ]; then
  echo "First run: creating database and applying schema..."
  npx prisma db push --skip-generate
  echo "Seeding database..."
  npx tsx --tsconfig tsconfig.json prisma/seed.ts
  echo "$CURRENT_HASH" > "$SCHEMA_HASH_FILE"
elif [ ! -f "$SCHEMA_HASH_FILE" ] || [ "$(cat "$SCHEMA_HASH_FILE")" != "$CURRENT_HASH" ]; then
  echo "Schema changed, applying migrations..."
  npx prisma db push --skip-generate
  echo "$CURRENT_HASH" > "$SCHEMA_HASH_FILE"
fi

# Start the app
HOSTNAME=0.0.0.0 PORT=3000 node server.js

#!/bin/bash
set -e

echo "Starting Thmanyah CMS..."

# Run database migrations
echo "Running database migrations..."
npx typeorm migration:run -d ormconfig.js

# Start the application
echo "Starting application..."
exec node dist/main.js 
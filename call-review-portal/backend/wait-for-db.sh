#!/bin/sh
# wait-for-db.sh
set -e

echo "Waiting for database at $DB_HOST:$DB_PORT..."

while ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
  sleep 2
done

echo "Database is ready!"
exec "$@"
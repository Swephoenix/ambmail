#!/bin/bash

# Script to reset UxMail database (PostgreSQL)

echo "Resetting UxMail database..."

# Run prisma migrate reset which drops the db, recreates it, applies migrations and seeds
npx prisma migrate reset --force

echo "Database reset complete! You can now start with a fresh UxMail installation."
echo "To start the application, run: npm run dev"

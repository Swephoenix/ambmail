#!/bin/bash

# Script to reset UxMail database and remove all accounts

echo "Resetting UxMail database..."

# Check if the database file exists
if [ -f "prisma/prisma/db.sqlite" ]; then
    echo "Found database file: prisma/prisma/db.sqlite"
    
    # Create a backup of the database
    cp prisma/prisma/db.sqlite prisma/prisma/db.sqlite.backup.$(date +%Y%m%d_%H%M%S)
    echo "Created backup: prisma/prisma/db.sqlite.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Use SQLite3 to delete all accounts from the database
    if command -v sqlite3 &> /dev/null; then
        echo "Deleting all accounts from the database..."
        sqlite3 prisma/prisma/db.sqlite "DELETE FROM Account;"
        sqlite3 prisma/prisma/db.sqlite "DELETE FROM Contact;"
        echo "All accounts and contacts have been deleted."
    else
        echo "SQLite3 is not installed or not in PATH. Please install SQLite3 to continue."
        echo "Alternatively, you can manually delete the database file:"
        echo "rm prisma/prisma/db.sqlite"
        exit 1
    fi
else
    echo "Database file not found at prisma/prisma/db.sqlite"
    echo "Attempting to recreate the database..."
    npx prisma db push
fi

echo "Database reset complete! You can now start with a fresh UxMail installation."
echo "To start the application, run: npm run dev"
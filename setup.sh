#!/bin/bash

# UxMail Installation Script

set -e  # Exit on any error

echo "Starting UxMail installation..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js (version 18 or higher) and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
if [ "$(printf '%s\n' "18.0.0" "$NODE_VERSION" | sort -V | head -n1)" = "18.0.0" ]; then
    echo "Node.js version is $NODE_VERSION"
else
    echo "Node.js version is too low. Please install Node.js version 18 or higher."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker to run the PostgreSQL database."
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Create .env file from .env.example
echo "Creating .env file..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo ".env file created from .env.example"
else
    echo ".env file already exists, skipping creation"
fi

# Start Database
echo "Starting database via Docker..."
docker compose up -d

# Wait for DB to be ready (naive wait, but usually prisma retries or fails fast, user can re-run)
echo "Waiting for database to initialize..."
sleep 5

# Initialize database
echo "Running migrations..."
npx prisma migrate dev

echo "Installation complete!"
echo "To start the development server, run: npm run dev"
echo "The application will be available at http://localhost:3000"

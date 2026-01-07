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

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "npm is not installed. Please install npm and try again."
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

# Initialize database
echo "Initializing database..."
npx prisma db push

echo "Installation complete!"
echo "To start the development server, run: npm run dev"
echo "The application will be available at http://localhost:3000"
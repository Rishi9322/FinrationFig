#!/bin/bash

echo ""
echo "============================================"
echo "Financial AI Expert - Quick Start"
echo "============================================"
echo ""

# Check Node.js installation
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed or not in PATH"
    echo "Download from: https://nodejs.org"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "ERROR: Node.js 16+ required"
    exit 1
fi

# Check Ollama connection
echo "Checking Ollama connection..."
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo ""
    echo "WARNING: Ollama appears to be offline"
    echo "Please start Ollama before running the system"
    echo ""
    echo "To start Ollama:"
    echo "  ollama serve"
    echo ""
    echo "To pull models:"
    echo "  ollama pull mistral"
    echo "  ollama pull neural-chat"
    echo ""
    read -p "Press Enter to continue anyway, or Ctrl+C to exit..."
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "ERROR: npm install failed"
        exit 1
    fi
fi

echo ""
echo "============================================"
echo "Setup Complete!"
echo "============================================"
echo ""
echo "Starting services..."
echo ""
echo "1. API Server will run on:  http://localhost:3001"
echo "2. Dashboard will run on:   http://localhost:3000"
echo ""

# Function to handle cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down services..."
    kill $API_PID 2>/dev/null
    kill $DASHBOARD_PID 2>/dev/null
    exit 0
}

# Set trap to cleanup on exit
trap cleanup EXIT INT TERM

# Start API server in background
echo "Starting API server..."
npm start &
API_PID=$!

# Wait for API to start
sleep 3

# Start dashboard in background
echo "Starting Dashboard..."
npm run dashboard &
DASHBOARD_PID=$!

# Wait a moment and open browser
sleep 2

# Try to open in browser (works on macOS and some Linux systems)
if command -v open &> /dev/null; then
    open http://localhost:3000
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000
fi

echo ""
echo "✅ Services are running!"
echo ""
echo "Dashboard: http://localhost:3000"
echo "API:       http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop services"
echo ""

# Wait for processes
wait $API_PID $DASHBOARD_PID

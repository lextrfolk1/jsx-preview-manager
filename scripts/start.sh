#!/bin/bash
cd "$(dirname "$0")/.."

echo "Starting Backend..."
cd backend
npm install
nohup node server.js > ../backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../backend.pid
echo "Backend started on port 3001 (PID: $BACKEND_PID)"

cd ../frontend
echo "Starting Frontend..."
npm install
nohup npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../frontend.pid
echo "Frontend started (PID: $FRONTEND_PID)"

echo "App is running! Frontend at http://localhost:5173"

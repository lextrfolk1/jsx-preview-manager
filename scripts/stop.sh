#!/bin/bash
cd "$(dirname "$0")/.."

if [ -f backend.pid ]; then
  kill $(cat backend.pid)
  rm backend.pid
  echo "Stopped Backend."
fi

if [ -f frontend.pid ]; then
  kill $(cat frontend.pid)
  rm frontend.pid
  echo "Stopped Frontend."
fi

echo "All services stopped."

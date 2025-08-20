#!/bin/bash
# Production startup script
export NODE_ENV=production
exec node dist/index.js
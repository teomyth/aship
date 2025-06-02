#!/usr/bin/env node

// Simple wrapper that delegates to the CLI package
import('@aship/cli/bin/run.js').catch(error => {
  console.error('Failed to start aship:', error.message);
  process.exit(1);
});

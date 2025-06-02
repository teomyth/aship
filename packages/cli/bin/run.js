#!/usr/bin/env node

import { flush, handle, run } from '@oclif/core';

// Get command line arguments
const args = process.argv.slice(2);

// Handle the case where no arguments are provided
// In this case, we want to run the default 'run' command
if (args.length === 0) {
  args.push('run');
}

await run(args, import.meta.url)
  .catch(async error => handle(error))
  .finally(async () => flush());

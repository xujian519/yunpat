#!/usr/bin/env node

const { runYunpatTui } = require("../scripts/run");

runYunpatTui().catch((error) => {
  console.error("Failed to start yunpat-tui:", error.message);
  process.exit(1);
});

#!/usr/bin/env node

const { runYunpat } = require("../scripts/run");

runYunpat().catch((error) => {
  console.error("Failed to start yunpat:", error.message);
  process.exit(1);
});

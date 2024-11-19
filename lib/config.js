"use strict";

import path from 'path';
import { fileURLToPath } from 'url';

// from https://nodejs.org/dist/latest-v16.x/docs/api/esm.html#no-json-module-loading
import { readFile } from 'node:fs/promises';
const config = JSON.parse(await readFile(new URL('../config.json', import.meta.url)));

// environment variables

// see http://expressjs.com/en/advanced/best-practice-performance.html#set-node_env-to-production
config.env = process.env["NODE_ENV"] || config.env || "dev";
config.port = process.env["PORT"] || config.port || 8080;
config.host = process.env["HOST"] || config.host || "localhost";
config.basedir = process.env["NODE_BASEDIR"] || config.basedir || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// DEBUG mode

// https://nodejs.org/docs/latest-v22.x/api/util.html#utildebuglogsection-callback
// https://www.npmjs.com/package/debug
config.debug = !!process.env["NODE_DEBUG"] || !!process.env["DEBUG"] || config.debug;

if (config.debug) {
  // prohibits production mode with debug on
  config.env = "dev";
}

config.production = config.env === "production";

// auth tokens and keys

config.ghToken = config.ghToken || "missing-GitHub-token";

// app specifics
config.refreshCycle = config.refreshCycle || 24;

config.destination = config.destination || path.resolve(config.basedir, "..");

// dump the configuration into the server log (but not in the server monitor!)
if (config.production) {
  console.log("".padStart(80, '-'));
  console.log("Configuration:");
  for (const [key, value] of Object.entries(config)) {
    console.log(`${key.padStart(20, ' ')} = ${value}`);
  }
  console.log("".padStart(80, '-'));
}

/**
 * Check if options are present. Returns a Set of the missing options, or null.
 * @param  {...any} options various options to be checked
 * @returns {null || Set}
 */
config.checkOptions = function(...options) {
  let incorrect = new Set();
  options.forEach(option => {
    if (!config[option]) {
      incorrect.add(option);
    }
  });
  if (incorrect.size === 0) return null;
  return incorrect;
}

export default config;

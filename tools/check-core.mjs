// Node runner: `npm test`
import { runChecks } from './core-check.js';
process.exit(runChecks() ? 1 : 0);

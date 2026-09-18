import assert from 'node:assert/strict';
import { analyzeSource } from './require-send.mjs';

const undelivered = analyzeSource(
  'fn demo() { let event = logger.info("hello"); }',
  'rust',
);
assert.equal(undelivered.length, 1, 'undelivered logger chain must be reported');

const delivered = analyzeSource(
  'fn demo() { logger.info("hello").send(); }',
  'rust',
);
assert.equal(delivered.length, 0, 'send() must satisfy the delivery contract');

const handedOff = analyzeSource(
  'fn demo() { return logger.info("hello"); }',
  'rust',
);
assert.equal(handedOff.length, 0, 'returned logger event is an intentional handoff');

console.log('require-send scanner fixtures passed');

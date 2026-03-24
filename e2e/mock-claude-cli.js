#!/usr/bin/env node
// Mock Claude CLI for E2E testing
// Simulates stream-json output format that EventParser can parse

const args = process.argv.slice(2);
const hasStreamJson = args.includes('--output-format') && args.includes('stream-json');

if (hasStreamJson) {
  // Find the task/prompt from -p argument
  const pIdx = args.indexOf('-p');
  const task = pIdx >= 0 ? args[pIdx + 1] : 'test task';

  const events = [
    {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: 'I will work on: ' + task }],
        usage: { input_tokens: 150, output_tokens: 50 },
      },
    },
    {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: 'Task completed successfully.' }],
        usage: { input_tokens: 200, output_tokens: 100 },
      },
    },
    {
      type: 'result',
      result: 'Task completed',
      usage: { input_tokens: 200, output_tokens: 100 },
      cost_usd: 0.005,
      duration_ms: 2000,
    },
  ];

  // Output events with small delays to simulate real behaviour
  let i = 0;
  function next() {
    if (i < events.length) {
      console.log(JSON.stringify(events[i]));
      i++;
      setTimeout(next, 100);
    } else {
      process.exit(0);
    }
  }
  next();
} else {
  // Interactive mode - just exit after a short delay
  console.log('Mock Claude Code - Interactive Mode');
  setTimeout(() => process.exit(0), 1000);
}

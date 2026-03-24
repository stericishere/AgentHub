#!/usr/bin/env node
/**
 * Browse MCP Server — standalone Node process using MCP stdio protocol.
 * Launched by Claude Code as an MCP server; proxies tool calls to browse-server HTTP.
 *
 * Usage: node browse-mcp-server.js <port> <token>
 */

import { BROWSE_TOOLS } from './browse-tools';

const [, , portArg, tokenArg] = process.argv;
const PORT = parseInt(portArg, 10);
const TOKEN = tokenArg;

if (!PORT || !TOKEN) {
  process.stderr.write('Usage: browse-mcp-server <port> <token>\n');
  process.exit(1);
}

const BASE_URL = `http://127.0.0.1:${PORT}`;

// MCP protocol: read JSON-RPC messages from stdin, write responses to stdout
let buffer = '';

process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk: string) => {
  buffer += chunk;
  // MCP uses Content-Length header + \r\n\r\n + JSON body
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;

    const header = buffer.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }

    const contentLength = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + contentLength) break;

    const body = buffer.slice(bodyStart, bodyStart + contentLength);
    buffer = buffer.slice(bodyStart + contentLength);

    handleMessage(body).catch((err) => {
      process.stderr.write(`MCP error: ${err.message}\n`);
    });
  }
});

function sendResponse(msg: unknown): void {
  const json = JSON.stringify(msg);
  const header = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n`;
  process.stdout.write(header + json);
}

async function handleMessage(raw: string): Promise<void> {
  const msg = JSON.parse(raw);

  if (msg.method === 'initialize') {
    sendResponse({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'browse-mcp-server', version: '1.0.0' },
      },
    });
    return;
  }

  if (msg.method === 'notifications/initialized') {
    // No response needed
    return;
  }

  if (msg.method === 'tools/list') {
    sendResponse({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        tools: BROWSE_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      },
    });
    return;
  }

  if (msg.method === 'tools/call') {
    const toolName: string = msg.params?.name;
    const args: Record<string, unknown> = msg.params?.arguments || {};

    // Map tool name to browse-server endpoint
    const endpointMap: Record<string, string> = {
      browse_navigate: '/navigate',
      browse_screenshot: '/screenshot',
      browse_click: '/click',
      browse_type: '/type',
      browse_read_text: '/read_text',
      browse_wait: '/wait',
    };

    const endpoint = endpointMap[toolName];
    if (!endpoint) {
      sendResponse({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
          isError: true,
        },
      });
      return;
    }

    try {
      const resp = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify(args),
      });

      const data = await resp.json();

      if (!resp.ok) {
        sendResponse({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            content: [{ type: 'text', text: `Error: ${data.error || resp.statusText}` }],
            isError: true,
          },
        });
        return;
      }

      // Special handling for screenshot — return as image content
      if (toolName === 'browse_screenshot' && data.screenshot) {
        sendResponse({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            content: [
              { type: 'image', data: data.screenshot, mimeType: 'image/png' },
              { type: 'text', text: `URL: ${data.url || ''}` },
            ],
          },
        });
        return;
      }

      sendResponse({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        },
      });
    } catch (err: any) {
      sendResponse({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          content: [{ type: 'text', text: `Request failed: ${err.message}` }],
          isError: true,
        },
      });
    }
    return;
  }

  // Unknown method
  sendResponse({
    jsonrpc: '2.0',
    id: msg.id,
    error: { code: -32601, message: `Method not found: ${msg.method}` },
  });
}

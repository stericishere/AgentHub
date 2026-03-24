/**
 * MCP Tool definitions for browse capabilities.
 * Each tool maps to a browse-server HTTP endpoint.
 */

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

export const BROWSE_TOOLS: McpToolDef[] = [
  {
    name: 'browse_navigate',
    description: 'Navigate the browser to a URL and return the page title.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to navigate to' },
      },
      required: ['url'],
    },
  },
  {
    name: 'browse_screenshot',
    description: 'Take a screenshot of the current page. Returns base64 PNG.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'browse_click',
    description:
      'Click an element on the page by CSS selector or accessibility ref attribute.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of element to click' },
        ref: { type: 'string', description: 'data-ref attribute value (accessibility tree)' },
      },
    },
  },
  {
    name: 'browse_type',
    description: 'Type text into an input element or the focused element.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to type' },
        selector: {
          type: 'string',
          description: 'CSS selector of input element (optional, types into focused element if omitted)',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'browse_read_text',
    description: 'Read the text content of an element on the page.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector (defaults to body)',
        },
      },
    },
  },
  {
    name: 'browse_wait',
    description:
      'Wait for a specified time or until an element appears on the page.',
    inputSchema: {
      type: 'object',
      properties: {
        ms: { type: 'number', description: 'Milliseconds to wait (max 10000)' },
        selector: {
          type: 'string',
          description: 'CSS selector to wait for (optional)',
        },
      },
    },
  },
];

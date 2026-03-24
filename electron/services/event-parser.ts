import { EventEmitter } from 'events';
import type { SessionEventType } from '../types';

export interface ParsedEvent {
  type: SessionEventType;
  subtype?: string;
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  raw: Record<string, unknown>;
}

/**
 * Parses Claude Code stream-json output into structured events.
 *
 * Claude Code stream-json format outputs one JSON object per line.
 * PTY output may contain mixed ANSI + JSON, so we buffer by lines
 * and only attempt to parse lines that look like JSON objects.
 */
export class EventParser extends EventEmitter {
  private buffer = '';

  /**
   * Feed raw PTY data. Buffers partial lines, emits 'event' for each parsed JSON line.
   */
  feed(data: string): void {
    this.buffer += data;

    const lines = this.buffer.split('\n');
    // Keep the last (potentially incomplete) line in the buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Only attempt to parse lines that start with '{'
      if (trimmed.startsWith('{')) {
        try {
          const json = JSON.parse(trimmed);
          const event = this.classify(json);
          if (event) {
            this.emit('event', event);
          }
        } catch {
          // Not valid JSON, skip (could be ANSI-decorated output)
        }
      }
    }
  }

  /**
   * Flush any remaining buffer content (e.g., on process exit).
   */
  flush(): void {
    if (this.buffer.trim()) {
      const trimmed = this.buffer.trim();
      if (trimmed.startsWith('{')) {
        try {
          const json = JSON.parse(trimmed);
          const event = this.classify(json);
          if (event) {
            this.emit('event', event);
          }
        } catch {
          // Incomplete JSON, discard
        }
      }
      this.buffer = '';
    }
  }

  /**
   * Reset the parser state.
   */
  reset(): void {
    this.buffer = '';
  }

  /**
   * Classify a parsed JSON object into a SessionEvent.
   */
  private classify(json: Record<string, unknown>): ParsedEvent | null {
    const type = json.type as string;

    // Claude Code stream-json event types
    switch (type) {
      case 'assistant': {
        const message = json.message as Record<string, unknown> | undefined;
        const content = this.extractTextContent(message);
        const usage = message?.usage as Record<string, number> | undefined;
        return {
          type: 'assistant',
          content,
          inputTokens: usage?.input_tokens,
          outputTokens: usage?.output_tokens,
          raw: json,
        };
      }

      case 'user': {
        const message = json.message as Record<string, unknown> | undefined;
        return {
          type: 'user',
          content: this.extractTextContent(message),
          raw: json,
        };
      }

      case 'tool_use': {
        const name = json.name as string | undefined;
        const input = json.input as Record<string, unknown> | undefined;
        return {
          type: 'tool_use',
          toolName: name,
          toolInput: input,
          raw: json,
        };
      }

      case 'tool_result': {
        const content = (json.content as string) || (json.output as string) || '';
        return {
          type: 'tool_result',
          content: typeof content === 'string' ? content : JSON.stringify(content),
          raw: json,
        };
      }

      case 'result': {
        const result = json.result as string | undefined;
        const usage = json.usage as Record<string, number> | undefined;
        const costUsd = json.cost_usd as number | undefined;
        const durationMs = json.duration_ms as number | undefined;
        return {
          type: 'result',
          content: result,
          costUsd,
          inputTokens: usage?.input_tokens,
          outputTokens: usage?.output_tokens,
          durationMs,
          raw: json,
        };
      }

      case 'error': {
        const error = json.error as Record<string, unknown> | undefined;
        return {
          type: 'error',
          content: (error?.message as string) || JSON.stringify(json),
          raw: json,
        };
      }

      case 'system': {
        return {
          type: 'system',
          subtype: json.subtype as string | undefined,
          content: json.message as string | undefined,
          raw: json,
        };
      }

      default: {
        // Unknown event type — still emit as system for visibility
        if (type) {
          return {
            type: 'system',
            subtype: type,
            content: JSON.stringify(json),
            raw: json,
          };
        }
        return null;
      }
    }
  }

  private extractTextContent(message: Record<string, unknown> | undefined): string {
    if (!message) return '';
    const content = message.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    }
    return '';
  }
}

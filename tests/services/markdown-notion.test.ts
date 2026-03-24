import {
  parseRichText,
  richTextToMarkdown,
  markdownToBlocks,
  blocksToMarkdown,
  contentHash,
} from '../../electron/services/markdown-notion';

describe('parseRichText', () => {
  it('parses plain text', () => {
    const result = parseRichText('hello world');
    expect(result).toHaveLength(1);
    expect(result[0].text.content).toBe('hello world');
    expect(result[0].annotations.bold).toBe(false);
  });

  it('parses **bold**', () => {
    const result = parseRichText('hello **bold** text');
    expect(result).toHaveLength(3);
    expect(result[1].text.content).toBe('bold');
    expect(result[1].annotations.bold).toBe(true);
  });

  it('parses *italic*', () => {
    const result = parseRichText('hello *italic* text');
    expect(result).toHaveLength(3);
    expect(result[1].text.content).toBe('italic');
    expect(result[1].annotations.italic).toBe(true);
  });

  it('parses `inline code`', () => {
    const result = parseRichText('use `npm install`');
    expect(result).toHaveLength(2);
    expect(result[1].text.content).toBe('npm install');
    expect(result[1].annotations.code).toBe(true);
  });

  it('parses ~~strikethrough~~', () => {
    const result = parseRichText('~~removed~~');
    expect(result).toHaveLength(1);
    expect(result[0].text.content).toBe('removed');
    expect(result[0].annotations.strikethrough).toBe(true);
  });

  it('parses [link](url)', () => {
    const result = parseRichText('visit [Google](https://google.com)');
    expect(result).toHaveLength(2);
    expect(result[1].text.content).toBe('Google');
    expect(result[1].text.link?.url).toBe('https://google.com');
  });

  it('returns empty text segment for empty string', () => {
    const result = parseRichText('');
    expect(result).toHaveLength(1);
    expect(result[0].text.content).toBe('');
  });
});

describe('richTextToMarkdown', () => {
  it('converts plain text', () => {
    const rt = [{ type: 'text' as const, text: { content: 'hello' }, annotations: { bold: false, italic: false, code: false, strikethrough: false, underline: false, color: 'default' as const } }];
    expect(richTextToMarkdown(rt)).toBe('hello');
  });

  it('converts bold', () => {
    const rt = [{ type: 'text' as const, text: { content: 'bold' }, annotations: { bold: true, italic: false, code: false, strikethrough: false, underline: false, color: 'default' as const } }];
    expect(richTextToMarkdown(rt)).toBe('**bold**');
  });

  it('converts italic', () => {
    const rt = [{ type: 'text' as const, text: { content: 'em' }, annotations: { bold: false, italic: true, code: false, strikethrough: false, underline: false, color: 'default' as const } }];
    expect(richTextToMarkdown(rt)).toBe('*em*');
  });

  it('converts code', () => {
    const rt = [{ type: 'text' as const, text: { content: 'fn()' }, annotations: { bold: false, italic: false, code: true, strikethrough: false, underline: false, color: 'default' as const } }];
    expect(richTextToMarkdown(rt)).toBe('`fn()`');
  });
});

describe('markdownToBlocks', () => {
  it('converts H1 heading', () => {
    const blocks = markdownToBlocks('# Hello');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('heading_1');
  });

  it('converts H2 heading', () => {
    const blocks = markdownToBlocks('## Sub');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('heading_2');
  });

  it('converts H3 heading', () => {
    const blocks = markdownToBlocks('### Section');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('heading_3');
  });

  it('converts H4+ as bold heading_3', () => {
    const blocks = markdownToBlocks('#### Deep');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('heading_3');
    expect(blocks[0].heading_3.rich_text[0].annotations.bold).toBe(true);
  });

  it('converts bulleted list', () => {
    const blocks = markdownToBlocks('- item 1\n- item 2');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('bulleted_list_item');
    expect(blocks[1].type).toBe('bulleted_list_item');
  });

  it('converts numbered list', () => {
    const blocks = markdownToBlocks('1. first\n2. second');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('numbered_list_item');
  });

  it('converts checkbox (unchecked)', () => {
    const blocks = markdownToBlocks('- [ ] todo');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('to_do');
    expect(blocks[0].to_do.checked).toBe(false);
  });

  it('converts checkbox (checked)', () => {
    const blocks = markdownToBlocks('- [x] done');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('to_do');
    expect(blocks[0].to_do.checked).toBe(true);
  });

  it('converts code block', () => {
    const blocks = markdownToBlocks('```typescript\nconst x = 1;\n```');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('code');
    expect(blocks[0].code.language).toBe('typescript');
    expect(blocks[0].code.rich_text[0].text.content).toBe('const x = 1;');
  });

  it('converts code block with ts shorthand', () => {
    const blocks = markdownToBlocks('```ts\nlet y = 2;\n```');
    expect(blocks[0].code.language).toBe('typescript');
  });

  it('converts blockquote', () => {
    const blocks = markdownToBlocks('> important note');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('quote');
  });

  it('converts divider', () => {
    const blocks = markdownToBlocks('---');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('divider');
  });

  it('converts paragraph', () => {
    const blocks = markdownToBlocks('Just a paragraph.');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
  });

  it('converts table', () => {
    const md = '| Col A | Col B |\n| --- | --- |\n| val1 | val2 |';
    const blocks = markdownToBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('table');
    expect(blocks[0].table.table_width).toBe(2);
    expect(blocks[0].table.children).toHaveLength(2); // header + 1 data row (separator skipped)
  });

  it('skips empty lines', () => {
    const blocks = markdownToBlocks('\n\n# Title\n\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('heading_1');
  });
});

describe('blocksToMarkdown', () => {
  it('converts heading_1', () => {
    const blocks = [{ type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: 'Title' }, annotations: { bold: false, italic: false, code: false, strikethrough: false, underline: false, color: 'default' } }] } }];
    expect(blocksToMarkdown(blocks)).toBe('# Title\n');
  });

  it('converts paragraph', () => {
    const blocks = [{ type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'Hello' }, annotations: { bold: false, italic: false, code: false, strikethrough: false, underline: false, color: 'default' } }] } }];
    expect(blocksToMarkdown(blocks)).toBe('Hello\n');
  });

  it('converts bulleted list items', () => {
    const blocks = [
      { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'a' }, annotations: { bold: false, italic: false, code: false, strikethrough: false, underline: false, color: 'default' } }] } },
      { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'b' }, annotations: { bold: false, italic: false, code: false, strikethrough: false, underline: false, color: 'default' } }] } },
    ];
    expect(blocksToMarkdown(blocks)).toBe('- a\n- b\n');
  });

  it('converts divider', () => {
    const blocks = [{ type: 'divider', divider: {} }];
    expect(blocksToMarkdown(blocks)).toBe('---\n');
  });

  it('converts code block', () => {
    const blocks = [{
      type: 'code',
      code: {
        language: 'javascript',
        rich_text: [{ type: 'text', text: { content: 'const x = 1;' }, annotations: { bold: false, italic: false, code: false, strikethrough: false, underline: false, color: 'default' } }],
      },
    }];
    const result = blocksToMarkdown(blocks);
    expect(result).toContain('```javascript');
    expect(result).toContain('const x = 1;');
    expect(result).toContain('```');
  });

  it('converts to_do', () => {
    const blocks = [
      { type: 'to_do', to_do: { checked: false, rich_text: [{ type: 'text', text: { content: 'task' }, annotations: { bold: false, italic: false, code: false, strikethrough: false, underline: false, color: 'default' } }] } },
      { type: 'to_do', to_do: { checked: true, rich_text: [{ type: 'text', text: { content: 'done' }, annotations: { bold: false, italic: false, code: false, strikethrough: false, underline: false, color: 'default' } }] } },
    ];
    const result = blocksToMarkdown(blocks);
    expect(result).toContain('- [ ] task');
    expect(result).toContain('- [x] done');
  });
});

describe('roundtrip', () => {
  it('preserves headings through roundtrip', () => {
    const original = '# Title\n\n## Subtitle\n\n### Section\n';
    const blocks = markdownToBlocks(original);
    const result = blocksToMarkdown(blocks);
    expect(result).toContain('# Title');
    expect(result).toContain('## Subtitle');
    expect(result).toContain('### Section');
  });

  it('preserves lists through roundtrip', () => {
    const original = '- item 1\n- item 2\n';
    const blocks = markdownToBlocks(original);
    const result = blocksToMarkdown(blocks);
    expect(result).toContain('- item 1');
    expect(result).toContain('- item 2');
  });

  it('preserves checkboxes through roundtrip', () => {
    const original = '- [ ] pending\n- [x] completed\n';
    const blocks = markdownToBlocks(original);
    const result = blocksToMarkdown(blocks);
    expect(result).toContain('- [ ] pending');
    expect(result).toContain('- [x] completed');
  });
});

describe('contentHash', () => {
  it('returns consistent hash for same content', () => {
    expect(contentHash('hello')).toBe(contentHash('hello'));
  });

  it('returns different hash for different content', () => {
    expect(contentHash('hello')).not.toBe(contentHash('world'));
  });

  it('returns 16 character hex string', () => {
    const hash = contentHash('test');
    expect(hash).toHaveLength(16);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });
});

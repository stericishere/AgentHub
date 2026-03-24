// Markdown ↔ Notion Block 雙向轉換器
// 逐行狀態機解析，零依賴。適用於知識庫 / 專案文件（40-100 行的簡單 Markdown）。

import { createHash } from 'crypto';

// ── Rich Text 解析 ─────────────────────────────────────

interface RichTextSegment {
  type: 'text';
  text: { content: string; link?: { url: string } | null };
  annotations: {
    bold: boolean;
    italic: boolean;
    code: boolean;
    strikethrough: boolean;
    underline: boolean;
    color: 'default';
  };
}

const DEFAULT_ANNOTATIONS = {
  bold: false,
  italic: false,
  code: false,
  strikethrough: false,
  underline: false,
  color: 'default' as const,
};

export function parseRichText(text: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  // 簡化正則：匹配 **bold**, *italic*, `code`, ~~strike~~, [link](url)
  const pattern =
    /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\~\~(.+?)\~\~)|(\[([^\]]+)\]\(([^)]+)\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // 前綴純文字
    if (match.index > lastIndex) {
      segments.push(makeTextSegment(text.slice(lastIndex, match.index)));
    }

    if (match[1]) {
      // **bold**
      segments.push(makeTextSegment(match[2], { bold: true }));
    } else if (match[3]) {
      // *italic*
      segments.push(makeTextSegment(match[4], { italic: true }));
    } else if (match[5]) {
      // `code`
      segments.push(makeTextSegment(match[6], { code: true }));
    } else if (match[7]) {
      // ~~strikethrough~~
      segments.push(makeTextSegment(match[8], { strikethrough: true }));
    } else if (match[9]) {
      // [text](url)
      segments.push(makeLinkSegment(match[10], match[11]));
    }

    lastIndex = match.index + match[0].length;
  }

  // 尾部純文字
  if (lastIndex < text.length) {
    segments.push(makeTextSegment(text.slice(lastIndex)));
  }

  // 空字串安全處理
  if (segments.length === 0) {
    segments.push(makeTextSegment(''));
  }

  return segments;
}

function makeTextSegment(
  content: string,
  overrides: Partial<RichTextSegment['annotations']> = {},
): RichTextSegment {
  return {
    type: 'text',
    text: { content },
    annotations: { ...DEFAULT_ANNOTATIONS, ...overrides },
  };
}

function makeLinkSegment(content: string, url: string): RichTextSegment {
  return {
    type: 'text',
    text: { content, link: { url } },
    annotations: { ...DEFAULT_ANNOTATIONS },
  };
}

// ── Rich Text → Markdown ───────────────────────────────

export function richTextToMarkdown(richTexts: RichTextSegment[]): string {
  return richTexts
    .map((rt) => {
      let text = rt.text.content;
      if (rt.annotations.code) text = `\`${text}\``;
      if (rt.annotations.bold) text = `**${text}**`;
      if (rt.annotations.italic) text = `*${text}*`;
      if (rt.annotations.strikethrough) text = `~~${text}~~`;
      if (rt.text.link?.url) text = `[${rt.text.content}](${rt.text.link.url})`;
      return text;
    })
    .join('');
}

// ── Markdown → Notion Blocks ───────────────────────────

export function markdownToBlocks(markdown: string): any[] {
  const lines = markdown.split('\n');
  const blocks: any[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 空行跳過
    if (line.trim() === '') {
      i++;
      continue;
    }

    // 水平線
    if (/^---+\s*$/.test(line)) {
      blocks.push({ object: 'block', type: 'divider', divider: {} });
      i++;
      continue;
    }

    // 標題
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      if (level === 1) {
        blocks.push(makeHeadingBlock('heading_1', text));
      } else if (level === 2) {
        blocks.push(makeHeadingBlock('heading_2', text));
      } else if (level === 3) {
        blocks.push(makeHeadingBlock('heading_3', text));
      } else {
        // H4+ → heading_3 with bold
        blocks.push(makeHeadingBlock('heading_3', text, true));
      }
      i++;
      continue;
    }

    // 程式碼區塊
    const codeMatch = line.match(/^```(\w*)$/);
    if (codeMatch) {
      const language = codeMatch[1] || 'plain text';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // 跳過結尾 ```
      blocks.push({
        object: 'block',
        type: 'code',
        code: {
          rich_text: [makeTextSegment(codeLines.join('\n'))],
          language: mapLanguage(language),
        },
      });
      continue;
    }

    // 引用
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({
        object: 'block',
        type: 'quote',
        quote: { rich_text: parseRichText(quoteLines.join('\n')) },
      });
      continue;
    }

    // 表格
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableRows: string[][] = [];
      // 收集表格行
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        const row = lines[i]
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim());
        i++;
        // 跳過分隔行 (--- | ---)
        if (row.every((cell) => /^[-:]+$/.test(cell))) continue;
        tableRows.push(row);
      }
      if (tableRows.length > 0) {
        const width = Math.max(...tableRows.map((r) => r.length));
        blocks.push({
          object: 'block',
          type: 'table',
          table: {
            table_width: width,
            has_column_header: true,
            has_row_header: false,
            children: tableRows.map((row) => ({
              object: 'block',
              type: 'table_row',
              table_row: {
                cells: Array.from({ length: width }, (_, ci) =>
                  parseRichText(row[ci] || ''),
                ),
              },
            })),
          },
        });
      }
      continue;
    }

    // Checkbox (to_do)
    const todoMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (todoMatch) {
      blocks.push({
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: parseRichText(todoMatch[2]),
          checked: todoMatch[1] !== ' ',
        },
      });
      i++;
      continue;
    }

    // 編號清單
    const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: parseRichText(numberedMatch[1]) },
      });
      i++;
      continue;
    }

    // 無序清單
    const bulletMatch = line.match(/^[-*+]\s+(.+)$/);
    if (bulletMatch) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: parseRichText(bulletMatch[1]) },
      });
      i++;
      continue;
    }

    // 預設：段落
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: parseRichText(line) },
    });
    i++;
  }

  return blocks;
}

function makeHeadingBlock(type: string, text: string, forceBold = false): any {
  const richText = parseRichText(text);
  if (forceBold) {
    richText.forEach((rt) => (rt.annotations.bold = true));
  }
  return {
    object: 'block',
    type,
    [type]: { rich_text: richText },
  };
}

function mapLanguage(lang: string): string {
  const map: Record<string, string> = {
    ts: 'typescript',
    js: 'javascript',
    py: 'python',
    rb: 'ruby',
    sh: 'bash',
    yml: 'yaml',
    md: 'markdown',
    '': 'plain text',
  };
  return map[lang] || lang;
}

// ── Notion Blocks → Markdown ───────────────────────────

export function blocksToMarkdown(blocks: any[]): string {
  const lines: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'heading_1':
        lines.push(`# ${richTextToMarkdown(block.heading_1.rich_text)}`);
        lines.push('');
        break;

      case 'heading_2':
        lines.push(`## ${richTextToMarkdown(block.heading_2.rich_text)}`);
        lines.push('');
        break;

      case 'heading_3':
        lines.push(`### ${richTextToMarkdown(block.heading_3.rich_text)}`);
        lines.push('');
        break;

      case 'paragraph':
        const pText = richTextToMarkdown(block.paragraph.rich_text);
        lines.push(pText);
        lines.push('');
        break;

      case 'bulleted_list_item':
        lines.push(`- ${richTextToMarkdown(block.bulleted_list_item.rich_text)}`);
        break;

      case 'numbered_list_item':
        lines.push(`1. ${richTextToMarkdown(block.numbered_list_item.rich_text)}`);
        break;

      case 'to_do':
        const checked = block.to_do.checked ? 'x' : ' ';
        lines.push(`- [${checked}] ${richTextToMarkdown(block.to_do.rich_text)}`);
        break;

      case 'code':
        const lang = block.code.language === 'plain text' ? '' : block.code.language;
        lines.push(`\`\`\`${lang}`);
        lines.push(richTextToMarkdown(block.code.rich_text));
        lines.push('```');
        lines.push('');
        break;

      case 'quote':
        const quoteText = richTextToMarkdown(block.quote.rich_text);
        quoteText.split('\n').forEach((ql: string) => lines.push(`> ${ql}`));
        lines.push('');
        break;

      case 'divider':
        lines.push('---');
        lines.push('');
        break;

      case 'table':
        if (block.table?.children) {
          const rows: string[][] = block.table.children.map((row: any) =>
            row.table_row.cells.map((cell: RichTextSegment[]) => richTextToMarkdown(cell)),
          );
          if (rows.length > 0) {
            const width = rows[0].length;
            // Header row
            lines.push('| ' + rows[0].join(' | ') + ' |');
            // Separator
            lines.push('| ' + Array(width).fill('------').join(' | ') + ' |');
            // Data rows
            for (let r = 1; r < rows.length; r++) {
              lines.push('| ' + rows[r].join(' | ') + ' |');
            }
            lines.push('');
          }
        }
        break;

      default:
        // 不支援的 block → 降級為段落
        if (block[block.type]?.rich_text) {
          lines.push(richTextToMarkdown(block[block.type].rich_text));
          lines.push('');
        }
        break;
    }
  }

  // 清理尾部多餘空行
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines.join('\n') + '\n';
}

// ── Content Hash ───────────────────────────────────────

export function contentHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex').slice(0, 16);
}

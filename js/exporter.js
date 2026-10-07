/**
 * Exporter and Document Formatter for Burmese Meeting Minutes
 * Supports: Word (.doc), Markdown (.md), Plain Text (.txt), Print / PDF, and Clipboard copy.
 * Includes a lightweight, zero-dependency Markdown parser tailored for Myanmar text and tables.
 */

class DocumentExporter {
  /**
   * Lightweight client-side Markdown to HTML parser
   * Handles Burmese Unicode, tables, task lists, headers, bold, italics, blockquotes.
   */
  static markdownToHtml(md) {
    if (!md) return '';

    let lines = md.split(/\r?\n/);
    let html = [];
    let inTable = false;
    let tableRows = [];
    let inList = false;
    let listType = ''; // 'ul' or 'ol'
    let inCode = false;
    let inQuote = false;
    let quoteLines = [];

    function flushTable() {
      if (!inTable) return;
      let tableHtml = '<div class="table-responsive"><table class="minutes-table">';
      tableRows.forEach((row, idx) => {
        // Skip markdown separator row |---|---|
        if (row.every(cell => /^[\s-:]+$/.test(cell))) return;

        let tag = idx === 0 ? 'th' : 'td';
        tableHtml += '<tr>';
        row.forEach(cell => {
          tableHtml += `<${tag}>${DocumentExporter.inlineFormat(cell.trim())}</${tag}>`;
        });
        tableHtml += '</tr>';
      });
      tableHtml += '</table></div>';
      html.push(tableHtml);
      inTable = false;
      tableRows = [];
    }

    function flushList() {
      if (!inList) return;
      html.push(`</${listType}>`);
      inList = false;
      listType = '';
    }

    function flushQuote() {
      if (!inQuote) return;
      html.push(`<blockquote class="minutes-quote">${quoteLines.map(l => DocumentExporter.inlineFormat(l)).join('<br />')}</blockquote>`);
      inQuote = false;
      quoteLines = [];
    }

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Code blocks
      if (line.trim().startsWith('```')) {
        flushTable();
        flushList();
        flushQuote();
        if (!inCode) {
          inCode = true;
          html.push('<pre><code>');
        } else {
          inCode = false;
          html.push('</code></pre>');
        }
        continue;
      }
      if (inCode) {
        html.push(DocumentExporter.escapeHtml(line));
        continue;
      }

      // Blockquotes (> )
      if (line.trim().startsWith('> ') || line.trim() === '>') {
        flushTable();
        flushList();
        inQuote = true;
        quoteLines.push(line.trim().startsWith('> ') ? line.trim().slice(2) : '');
        continue;
      } else if (inQuote) {
        flushQuote();
      }

      // Table lines: | col1 | col2 |
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        flushList();
        inTable = true;
        let cells = line.split('|').slice(1, -1);
        tableRows.push(cells);
        continue;
      } else if (inTable) {
        flushTable();
      }

      // Blank line
      if (!line.trim()) {
        flushList();
        html.push('');
        continue;
      }

      // Headings
      if (line.startsWith('# ')) {
        flushList();
        html.push(`<h1 class="minutes-h1">${DocumentExporter.inlineFormat(line.slice(2))}</h1>`);
        continue;
      }
      if (line.startsWith('## ')) {
        flushList();
        html.push(`<h2 class="minutes-h2">${DocumentExporter.inlineFormat(line.slice(3))}</h2>`);
        continue;
      }
      if (line.startsWith('### ')) {
        flushList();
        html.push(`<h3 class="minutes-h3">${DocumentExporter.inlineFormat(line.slice(4))}</h3>`);
        continue;
      }
      if (line.startsWith('#### ')) {
        flushList();
        html.push(`<h4 class="minutes-h4">${DocumentExporter.inlineFormat(line.slice(5))}</h4>`);
        continue;
      }

      // Horizontal rule
      if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
        flushList();
        html.push('<hr class="minutes-divider" />');
        continue;
      }

      // Task list item: - [ ] or - [x]
      const taskMatch = line.match(/^(\s*)(?:[-*]|\d+\.)\s+\[([ xX])\]\s+(.*)/);
      if (taskMatch) {
        if (!inList || listType !== 'ul') {
          flushList();
          inList = true;
          listType = 'ul';
          html.push('<ul class="minutes-task-list">');
        }
        const isIndented = taskMatch[1].length > 0;
        const checked = taskMatch[2].toLowerCase() === 'x' ? 'checked' : '';
        html.push(`<li class="task-item${isIndented ? ' sub-item' : ''}"><label><input type="checkbox" ${checked} class="task-checkbox" /> <span>${DocumentExporter.inlineFormat(taskMatch[3])}</span></label></li>`);
        continue;
      }

      // Bullet lists (- or * or +)
      const bulletMatch = line.match(/^(\s*)([-*+]|\+)\s+(.*)/);
      if (bulletMatch) {
        if (!inList || listType !== 'ul') {
          flushList();
          inList = true;
          listType = 'ul';
          html.push('<ul class="minutes-list">');
        }
        const isIndented = bulletMatch[1].length > 0;
        html.push(`<li${isIndented ? ' class="sub-item"' : ''}>${DocumentExporter.inlineFormat(bulletMatch[3])}</li>`);
        continue;
      }

      // Numbered lists (1. 2.)
      const numMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
      if (numMatch) {
        if (!inList || listType !== 'ol') {
          flushList();
          inList = true;
          listType = 'ol';
          html.push('<ol class="minutes-ordered-list">');
        }
        const isIndented = numMatch[1].length > 0;
        html.push(`<li${isIndented ? ' class="sub-item"' : ''}>${DocumentExporter.inlineFormat(numMatch[3])}</li>`);
        continue;
      }

      // Regular paragraph
      flushList();
      html.push(`<p class="minutes-p">${DocumentExporter.inlineFormat(line)}</p>`);
    }

    flushTable();
    flushList();
    flushQuote();

    return html.join('\n');
  }

  static inlineFormat(text) {
    if (!text) return '';
    let res = DocumentExporter.escapeHtml(text);

    // 1. Protect inline code with tokens
    const codeTokens = [];
    res = res.replace(/`([^`]+)`/g, (match, code) => {
      codeTokens.push(`<code class="inline-code">${code}</code>`);
      return `@@@CODE_${codeTokens.length - 1}@@@`;
    });

    // 2. Markdown Links: [text](url) - allow safe URLs only
    res = res.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+|mailto:[^\s\)]+|#[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="minutes-link">$1</a>');

    // 3. Bold + Italic: ***text*** or ___text___
    res = res.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    res = res.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');

    // 4. Bold: **text** or __text__
    res = res.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    res = res.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // 5. Italic: *text* or _text_
    res = res.replace(/\*([^\*]+?)\*/g, '<em>$1</em>');
    res = res.replace(/(^|[\s(])_([^_]+?)_([\s).,!?;:]|$)/g, '$1<em>$2</em>$3');

    // 6. Strikethrough: ~~text~~
    res = res.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // 7. Restore inline code
    res = res.replace(/@@@CODE_(\d+)@@@/g, (match, idx) => codeTokens[Number(idx)]);

    return res;
  }

  static escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Extracts Action Items from Markdown tables, task checklists, and bullet lists.
   */
  static extractActionItems(markdown) {
    const items = [];
    if (!markdown) return items;

    const lines = markdown.split(/\r?\n/);
    let inActionTable = false;
    let inActionSection = false;
    let colIndices = { task: -1, owner: -1, due: -1, priority: -1 };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for section headings
      if (/^#{1,4}\s+.*(လုပ်ဆောင်ရန်|တာဝန်|action item|next step|task|အစီအမံ)/i.test(trimmed)) {
        inActionSection = true;
      } else if (/^#{1,4}\s+/.test(trimmed)) {
        inActionSection = false;
      }

      // Check for Table Headers
      if (line.includes('|') && (line.includes('တာဝန်') || line.includes('အစီအမံ') || /action|task|to-?do/i.test(line))) {
        inActionTable = true;
        colIndices = { task: -1, owner: -1, due: -1, priority: -1 };
        const headers = line.split('|').map(h => h.trim().toLowerCase());
        headers.forEach((h, idx) => {
          if (!h) return;
          if (/(တာဝန်ခံ|တာဝန်ယူသူ|တာဝန်ရှိသူ|တာဝန်ကျသူ|ဆောင်ရွက်သူ|လုပ်ဆောင်သူ|owner|assignee|pic|responsible|person)/i.test(h)) {
            colIndices.owner = idx;
          } else if (/(ရက်|ရက်စွဲ|သတ်မှတ်ရက်|due|deadline|date|timeline)/i.test(h)) {
            colIndices.due = idx;
          } else if (/(ဦးစားပေး|priority|level)/i.test(h)) {
            colIndices.priority = idx;
          } else if (/(လုပ်ဆောင်ရန်|အစီအမံ|လုပ်ငန်း|task|action|to-?do|agenda|အကြောင်းအရာ|ဆွေးနွေးချက်|အကြောင်း)/i.test(h) || (h.includes('တာဝန်') && !/(ခံ|ယူ|ရှိ|ကျ)/.test(h))) {
            colIndices.task = idx;
          }
        });
        continue;
      }

      if (inActionTable && line.includes('|')) {
        if (/^[\s|:-]+$/.test(line)) continue;
        const cells = line.split('|').map(c => c.trim());
        if (cells.length > 2) {
          let task = '';
          if (colIndices.task !== -1 && cells[colIndices.task]) {
            task = cells[colIndices.task];
          } else {
            for (let c = 1; c < cells.length; c++) {
              if (c === colIndices.owner || c === colIndices.due || c === colIndices.priority) continue;
              if (cells[c] && !/^[\d\u1040-\u1049.\s-]+$/.test(cells[c])) {
                task = cells[c];
                break;
              }
            }
          }

          const hasMatchedHeaders = (colIndices.task !== -1 || colIndices.owner !== -1 || colIndices.due !== -1 || colIndices.priority !== -1);

          let owner = '-';
          if (colIndices.owner !== -1 && cells[colIndices.owner]) {
            owner = cells[colIndices.owner];
          } else if (!hasMatchedHeaders && cells[2]) {
            owner = cells[2];
          }

          let due = '-';
          if (colIndices.due !== -1 && cells[colIndices.due]) {
            due = cells[colIndices.due];
          } else if (!hasMatchedHeaders && cells[3]) {
            due = cells[3];
          }

          let priority = '-';
          if (colIndices.priority !== -1 && cells[colIndices.priority]) {
            priority = cells[colIndices.priority];
          } else if (!hasMatchedHeaders && cells[4]) {
            priority = cells[4];
          }

          if (task && !task.startsWith('---') && !/^(လုပ်ဆောင်ရန် တာဝန်|task|action item)$/i.test(task)) {
            items.push({
              id: 'task_' + items.length,
              task: task.replace(/[*_]/g, '').trim(),
              owner: (owner || '-').replace(/[*_]/g, '').trim(),
              due: (due || '-').replace(/[*_]/g, '').trim(),
              priority: (priority || '-').replace(/[*_]/g, '').trim(),
              completed: false
            });
          }
        }
        continue;
      } else if (inActionTable && !line.includes('|')) {
        inActionTable = false;
      }

      // Check for Checklist item: - [ ] or - [x]
      const checklistMatch = line.match(/^(\s*)(?:[-*]|\d+\.)\s+\[([ xX])\]\s+(.*)/);
      if (checklistMatch) {
        const isChecked = checklistMatch[2].toLowerCase() === 'x';
        const taskText = checklistMatch[3];
        const parsed = DocumentExporter._parseTaskMeta(taskText);
        items.push({
          id: 'task_' + items.length,
          task: parsed.task,
          owner: parsed.owner,
          due: parsed.due,
          priority: parsed.priority,
          completed: isChecked
        });
        continue;
      }

      // Check for bullet or numbered list inside Action Items section
      if (inActionSection) {
        const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)/);
        if (listMatch) {
          const content = listMatch[3].trim();
          if (content && content.length > 3) {
            const parsed = DocumentExporter._parseTaskMeta(content);
            items.push({
              id: 'task_' + items.length,
              task: parsed.task,
              owner: parsed.owner,
              due: parsed.due,
              priority: parsed.priority,
              completed: false
            });
          }
        }
      }
    }

    return items;
  }

  static _parseTaskMeta(text) {
    let clean = text.replace(/[*_]/g, '').trim();
    let owner = '-';
    let due = '-';
    let priority = '-';

    function extractField(regexList) {
      for (const rx of regexList) {
        const m = clean.match(rx);
        if (m) {
          let val = m[1].trim();
          val = val.replace(/\s+[-–—].*$/, '').replace(/[,;|()]+$/, '').trim();
          clean = clean.replace(m[0], ' ');
          return val;
        }
      }
      return '-';
    }

    owner = extractField([
      /(?:တာဝန်ခံ|တာဝန်ယူသူ|တာဝန်ရှိသူ|တာဝန်ကျသူ|ဆောင်ရွက်သူ|လုပ်ဆောင်သူ|owner|assignee|pic)\s*[:：\-]\s*([^,;|()]+?)(?=(?:\s+[-–—]\s+|\s*[,;|()]|\s*(?:သတ်မှတ်ရက်|ရက်စွဲ|ရက်|due|deadline|ဦးစားပေး|priority)|$))/i,
      /(?:တာဝန်ခံ|တာဝန်ယူသူ|တာဝန်ရှိသူ|တာဝန်ကျသူ|ဆောင်ရွက်သူ|လုပ်ဆောင်သူ|owner|assignee|pic)\s*[:：\-]\s*([^,;|()]+)/i
    ]);

    due = extractField([
      /(?:သတ်မှတ်ရက်|ရက်စွဲ|ရက်|due|deadline)\s*[:：\-]\s*([^,;|()]+?)(?=(?:\s+[-–—]\s+|\s*[,;|()]|\s*(?:တာဝန်ခံ|တာဝန်ယူသူ|တာဝန်ရှိသူ|တာဝန်ကျသူ|ဆောင်ရွက်သူ|လုပ်ဆောင်သူ|owner|assignee|pic|ဦးစားပေး|priority)|$))/i,
      /(?:သတ်မှတ်ရက်|ရက်စွဲ|ရက်|due|deadline)\s*[:：\-]\s*([^,;|()]+)/i
    ]);

    priority = extractField([
      /(?:ဦးစားပေး|priority)\s*[:：\-]\s*([^,;|()]+?)(?=(?:\s+[-–—]\s+|\s*[,;|()]|\s*(?:တာဝန်ခံ|တာဝန်ယူသူ|တာဝန်ရှိသူ|တာဝန်ကျသူ|ဆောင်ရွက်သူ|လုပ်ဆောင်သူ|owner|assignee|pic|သတ်မှတ်ရက်|ရက်စွဲ|ရက်|due|deadline)|$))/i,
      /(?:ဦးစားပေး|priority)\s*[:：\-]\s*([^,;|()]+)/i
    ]);

    // Clean up leftover parentheses or dashes
    clean = clean.replace(/[()\[\]{}|]+/g, ' ').replace(/\s+[-–—]\s+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    clean = clean.replace(/^[-–—:\s]+|[-–—:\s]+$/g, '');

    return {
      task: clean || text.replace(/[*_]/g, '').trim(),
      owner,
      due,
      priority
    };
  }

  /**
   * Generates Microsoft Word (.doc) file download.
   */
  static downloadWordDoc(title, markdownContent) {
    const htmlBody = DocumentExporter.markdownToHtml(markdownContent);
    const filename = `${(title || 'Meeting_Minutes').replace(/[^a-zA-Z0-9_\u1000-\u109F]/g, '_')}.doc`;

    const docContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${DocumentExporter.escapeHtml(title || 'Meeting Minutes')}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: 'Pyidaungsu', 'Myanmar3', 'Noto Sans Myanmar', 'Masterpiece Uni Sans', 'Segoe UI', Arial, sans-serif;
      font-size: 11.5pt;
      line-height: 1.85;
      color: #1e293b;
      margin: 1.2in 1in 1in 1in;
    }
    h1 {
      font-size: 18pt;
      color: #0f172a;
      border-bottom: 2pt solid #0284c7;
      padding-bottom: 6pt;
      margin-top: 12pt;
      margin-bottom: 12pt;
    }
    h2 {
      font-size: 14pt;
      color: #0369a1;
      margin-top: 16pt;
      margin-bottom: 6pt;
      border-bottom: 1pt solid #e2e8f0;
      padding-bottom: 3pt;
    }
    h3 {
      font-size: 12pt;
      color: #334155;
      margin-top: 12pt;
      margin-bottom: 4pt;
    }
    p {
      margin-bottom: 8pt;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12pt 0;
    }
    th, td {
      border: 1pt solid #cbd5e1;
      padding: 6pt 8pt;
      text-align: left;
    }
    th {
      background-color: #f1f5f9;
      font-weight: bold;
      color: #0f172a;
    }
    ul, ol {
      margin-top: 4pt;
      margin-bottom: 8pt;
      padding-left: 20pt;
    }
    li {
      margin-bottom: 3pt;
    }
    blockquote {
      border-left: 3pt solid #0284c7;
      background-color: #f8fafc;
      padding: 6pt 12pt;
      margin: 8pt 0;
      font-style: italic;
    }
  </style>
</head>
<body>
  ${htmlBody}
</body>
</html>
`;

    const blob = new Blob(['\ufeff', docContent], { type: 'application/msword;charset=utf-8' });
    DocumentExporter._triggerDownload(blob, filename);
  }

  /**
   * Generates Markdown (.md) file download.
   */
  static downloadMarkdown(title, markdownContent) {
    const filename = `${(title || 'Meeting_Minutes').replace(/[^a-zA-Z0-9_\u1000-\u109F]/g, '_')}.md`;
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    DocumentExporter._triggerDownload(blob, filename);
  }

  /**
   * Generates Plain Text (.txt) file download.
   */
  static downloadPlainText(title, markdownContent) {
    const filename = `${(title || 'Meeting_Minutes').replace(/[^a-zA-Z0-9_\u1000-\u109F]/g, '_')}.txt`;
    // Clean markdown hashes and bold stars for pure clean text
    const cleanText = markdownContent
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1');
    const blob = new Blob([cleanText], { type: 'text/plain;charset=utf-8' });
    DocumentExporter._triggerDownload(blob, filename);
  }

  /**
   * Copies formatted text or markdown to clipboard.
   */
  static async copyToClipboard(markdownContent) {
    if (navigator.clipboard && navigator.clipboard.write) {
      try {
        const html = DocumentExporter.markdownToHtml(markdownContent);
        const textBlob = new Blob([markdownContent], { type: 'text/plain' });
        const htmlBlob = new Blob([html], { type: 'text/html' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': textBlob,
            'text/html': htmlBlob
          })
        ]);
        return true;
      } catch (e) {
        // Fallback to text only
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(markdownContent);
      return true;
    }

    // Legacy fallback
    const textarea = document.createElement('textarea');
    textarea.value = markdownContent;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  }

  static _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}

// Export for both Browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DocumentExporter };
}

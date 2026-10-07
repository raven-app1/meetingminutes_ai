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

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Code blocks
      if (line.trim().startsWith('```')) {
        flushTable();
        flushList();
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
      const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)/);
      if (taskMatch) {
        if (!inList || listType !== 'ul') {
          flushList();
          inList = true;
          listType = 'ul';
          html.push('<ul class="minutes-task-list">');
        }
        const checked = taskMatch[1].toLowerCase() === 'x' ? 'checked' : '';
        html.push(`<li class="task-item"><label><input type="checkbox" ${checked} class="task-checkbox" /> <span>${DocumentExporter.inlineFormat(taskMatch[2])}</span></label></li>`);
        continue;
      }

      // Bullet lists (- or *)
      const bulletMatch = line.match(/^[-*]\s+(.*)/);
      if (bulletMatch) {
        if (!inList || listType !== 'ul') {
          flushList();
          inList = true;
          listType = 'ul';
          html.push('<ul class="minutes-list">');
        }
        html.push(`<li>${DocumentExporter.inlineFormat(bulletMatch[1])}</li>`);
        continue;
      }

      // Numbered lists (1. 2.)
      const numMatch = line.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        if (!inList || listType !== 'ol') {
          flushList();
          inList = true;
          listType = 'ol';
          html.push('<ol class="minutes-ordered-list">');
        }
        html.push(`<li>${DocumentExporter.inlineFormat(numMatch[2])}</li>`);
        continue;
      }

      // Blockquotes (> )
      if (line.startsWith('> ')) {
        flushList();
        html.push(`<blockquote class="minutes-quote">${DocumentExporter.inlineFormat(line.slice(2))}</blockquote>`);
        continue;
      }

      // Regular paragraph
      flushList();
      html.push(`<p class="minutes-p">${DocumentExporter.inlineFormat(line)}</p>`);
    }

    flushTable();
    flushList();

    return html.join('\n');
  }

  static inlineFormat(text) {
    if (!text) return '';
    let res = DocumentExporter.escapeHtml(text);
    // Bold: **text** or __text__
    res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    res = res.replace(/__(.*?)__/g, '<strong>$1</strong>');
    // Italic: *text* or _text_
    res = res.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Inline code: `code`
    res = res.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
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
   * Extracts Action Items from Markdown tables or bullet lists.
   */
  static extractActionItems(markdown) {
    const items = [];
    if (!markdown) return items;

    // Search for tables with "တာဝန်" or "Action Item"
    const lines = markdown.split(/\r?\n/);
    let inActionTable = false;
    let colIndices = { task: -1, owner: -1, due: -1, priority: -1 };

    for (let line of lines) {
      if (line.includes('|') && (line.includes('တာဝန်') || line.includes('Action') || line.includes('Task'))) {
        inActionTable = true;
        const headers = line.split('|').map(h => h.trim().toLowerCase());
        headers.forEach((h, idx) => {
          if (h.includes('တာဝန်ခံ') || h.includes('owner') || h.includes('assignee')) {
            colIndices.owner = idx;
          } else if (h.includes('တာဝန်') || h.includes('action') || h.includes('task')) {
            colIndices.task = idx;
          }
          if (h.includes('ရက်') || h.includes('due') || h.includes('deadline')) colIndices.due = idx;
          if (h.includes('ဦးစားပေး') || h.includes('priority')) colIndices.priority = idx;
        });
        continue;
      }

      if (inActionTable && line.includes('|')) {
        // Skip separator
        if (/^[\s|:-]+$/.test(line)) continue;
        const cells = line.split('|').map(c => c.trim());
        if (cells.length > 2) {
          const task = colIndices.task !== -1 ? cells[colIndices.task] : cells[1];
          const owner = colIndices.owner !== -1 ? cells[colIndices.owner] : (cells[2] || '-');
          const due = colIndices.due !== -1 ? cells[colIndices.due] : (cells[3] || '-');
          const priority = colIndices.priority !== -1 ? cells[colIndices.priority] : (cells[4] || '-');

          if (task && task !== 'လုပ်ဆောင်ရန် တာဝန်' && !task.startsWith('---')) {
            items.push({
              id: 'task_' + items.length,
              task: task.replace(/[*_]/g, ''),
              owner: owner.replace(/[*_]/g, ''),
              due: due.replace(/[*_]/g, ''),
              priority: priority.replace(/[*_]/g, ''),
              completed: false
            });
          }
        }
      } else if (inActionTable && !line.includes('|')) {
        inActionTable = false;
      }
    }

    return items;
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
      font-family: 'Pyidaungsu', 'Myanmar3', 'Noto Sans Myanmar', 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1e293b;
      margin: 1.5in 1in 1in 1in;
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

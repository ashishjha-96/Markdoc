// Popup script for Import to Markdown extension

// Generate a simple doc ID (similar to nanoid)
function generateDocId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let id = '';
  for (let i = 0; i < 21; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Show status message
function showStatus(message, type = 'success') {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status show ${type}`;
  
  setTimeout(() => {
    status.classList.remove('show');
  }, 3000);
}

// Load saved settings
chrome.storage.sync.get(['markdocUrl', 'includeImages', 'includeLinks', 'includeMetadata'], (result) => {
  if (result.markdocUrl) {
    document.getElementById('markdocUrl').value = result.markdocUrl;
  }
  if (result.includeImages !== undefined) {
    document.getElementById('includeImages').checked = result.includeImages;
  }
  if (result.includeLinks !== undefined) {
    document.getElementById('includeLinks').checked = result.includeLinks;
  }
  if (result.includeMetadata !== undefined) {
    document.getElementById('includeMetadata').checked = result.includeMetadata;
  }
});

// Save settings when changed
document.getElementById('markdocUrl').addEventListener('change', (e) => {
  chrome.storage.sync.set({ markdocUrl: e.target.value });
});

document.getElementById('includeImages').addEventListener('change', (e) => {
  chrome.storage.sync.set({ includeImages: e.target.checked });
});

document.getElementById('includeLinks').addEventListener('change', (e) => {
  chrome.storage.sync.set({ includeLinks: e.target.checked });
});

document.getElementById('includeMetadata').addEventListener('change', (e) => {
  chrome.storage.sync.set({ includeMetadata: e.target.checked });
});

// Copy button handler
document.getElementById('copyBtn').addEventListener('click', async () => {
  const button = document.getElementById('copyBtn');
  button.disabled = true;
  button.innerHTML = '<span class="loading"></span>Copying...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const options = {
      includeImages: document.getElementById('includeImages').checked,
      includeLinks: document.getElementById('includeLinks').checked,
      includeMetadata: document.getElementById('includeMetadata').checked,
    };

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractContent,
      args: [options],
    });

    if (result && result.result) {
      await navigator.clipboard.writeText(result.result);
      showStatus('✓ Copied to clipboard!', 'success');
    } else {
      throw new Error('Failed to extract content');
    }
  } catch (error) {
    console.error('Error:', error);
    showStatus('✗ Failed to copy content', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Copy';
  }
});

// Import button handler
document.getElementById('importBtn').addEventListener('click', async () => {
  const button = document.getElementById('importBtn');
  button.disabled = true;
  button.innerHTML = '<span class="loading"></span>Importing...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const markdocUrl = document.getElementById('markdocUrl').value.trim();
    
    if (!markdocUrl) {
      throw new Error('Please enter a Markdoc URL');
    }

    const options = {
      includeImages: document.getElementById('includeImages').checked,
      includeLinks: document.getElementById('includeLinks').checked,
      includeMetadata: document.getElementById('includeMetadata').checked,
    };

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractContent,
      args: [options],
    });

    if (result && result.result) {
      const docId = generateDocId();
      const markdown = result.result;
      
      // Store markdown temporarily with a timestamp
      const importData = {
        markdown,
        timestamp: Date.now(),
        sourceUrl: tab.url,
        sourceTitle: tab.title,
      };
      
      // Store in chrome.storage (accessible across origins)
      await chrome.storage.local.set({ [`import_${docId}`]: importData });
      
      // Open new tab with the markdoc URL
      const docUrl = `${markdocUrl}/${docId}?import=true`;
      await chrome.tabs.create({ url: docUrl });
      
      showStatus('✓ Opened in Markdoc!', 'success');
      
      // Close popup after a short delay
      setTimeout(() => window.close(), 1000);
    } else {
      throw new Error('Failed to extract content');
    }
  } catch (error) {
    console.error('Error:', error);
    showStatus(`✗ ${error.message}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Import';
  }
});

// Content extraction function (runs in the page context)
function extractContent(options) {
  // Helper to convert HTML to Markdown
  function htmlToMarkdown(html, opts) {
    let markdown = '';
    
    // Detect if this is a code file page on any platform
    const isCodeFile = detectCodeFilePage();
    if (isCodeFile) {
      const codeMarkdown = extractCodeFile(opts);
      if (codeMarkdown) {
        return codeMarkdown;
      }
      // If code extraction failed, continue with regular extraction
    }
    
    // Get main content (try various selectors for article content)
    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '.post-content',
      '.article-content',
      '.content',
      '#content',
      'body',
    ];
    
    let mainContent = null;
    for (const selector of selectors) {
      mainContent = document.querySelector(selector);
      if (mainContent) break;
    }
    
    if (!mainContent) {
      mainContent = document.body;
    }
    
    // Clone to avoid modifying the actual page
    const content = mainContent.cloneNode(true);
    
    // Remove unwanted elements
    const unwantedSelectors = [
      'script', 'style', 'nav', 'header', 'footer', 
      'aside', '.sidebar', '.advertisement', '.ads',
      '.comments', '.related-posts', 'iframe'
    ];
    unwantedSelectors.forEach(selector => {
      content.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    // Convert to markdown
    function processNode(node, depth = 0) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        return text ? text + ' ' : '';
      }
      
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }
      
      const tag = node.tagName.toLowerCase();
      let result = '';
      
      switch (tag) {
        case 'h1':
          result = '\n# ' + node.textContent.trim() + '\n\n';
          break;
        case 'h2':
          result = '\n## ' + node.textContent.trim() + '\n\n';
          break;
        case 'h3':
          result = '\n### ' + node.textContent.trim() + '\n\n';
          break;
        case 'h4':
          result = '\n#### ' + node.textContent.trim() + '\n\n';
          break;
        case 'h5':
          result = '\n##### ' + node.textContent.trim() + '\n\n';
          break;
        case 'h6':
          result = '\n###### ' + node.textContent.trim() + '\n\n';
          break;
        case 'p':
          result = Array.from(node.childNodes).map(child => processNode(child, depth)).join('') + '\n\n';
          break;
        case 'br':
          result = '\n';
          break;
        case 'strong':
        case 'b':
          result = '**' + node.textContent.trim() + '**';
          break;
        case 'em':
        case 'i':
          result = '*' + node.textContent.trim() + '*';
          break;
        case 'code':
          if (node.parentElement.tagName.toLowerCase() === 'pre') {
            result = '\n```\n' + node.textContent + '\n```\n\n';
          } else {
            result = '`' + node.textContent + '`';
          }
          break;
        case 'pre':
          const codeEl = node.querySelector('code');
          if (codeEl) {
            result = '\n```\n' + codeEl.textContent + '\n```\n\n';
          } else {
            result = '\n```\n' + node.textContent + '\n```\n\n';
          }
          break;
        case 'a':
          if (opts.includeLinks) {
            const text = node.textContent.trim();
            const href = node.getAttribute('href') || '';
            result = `[${text}](${href})`;
          } else {
            result = node.textContent.trim();
          }
          break;
        case 'img':
          if (opts.includeImages) {
            const alt = node.getAttribute('alt') || 'image';
            const src = node.getAttribute('src') || '';
            result = `![${alt}](${src})\n\n`;
          }
          break;
        case 'ul':
        case 'ol':
          result = '\n' + Array.from(node.children).map((li, i) => {
            const bullet = tag === 'ul' ? '-' : `${i + 1}.`;
            const text = Array.from(li.childNodes).map(child => processNode(child, depth + 1)).join('').trim();
            return `${bullet} ${text}`;
          }).join('\n') + '\n\n';
          break;
        case 'blockquote':
          const quote = Array.from(node.childNodes).map(child => processNode(child, depth)).join('').trim();
          result = '\n> ' + quote.split('\n').join('\n> ') + '\n\n';
          break;
        case 'hr':
          result = '\n---\n\n';
          break;
        default:
          result = Array.from(node.childNodes).map(child => processNode(child, depth)).join('');
      }
      
      return result;
    }
    
    markdown = processNode(content);
    
    // Add metadata if requested
    if (opts.includeMetadata) {
      const title = document.title || 'Untitled';
      const url = window.location.href;
      const date = new Date().toISOString().split('T')[0];
      
      markdown = `# ${title}\n\n` +
                `**Source:** [${url}](${url})  \n` +
                `**Imported:** ${date}\n\n` +
                `---\n\n` +
                markdown;
    }
    
    // Clean up extra whitespace
    markdown = markdown
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();
    
    return markdown;
  }
  
  // Detect if current page is a code file viewer
  function detectCodeFilePage() {
    const url = window.location.href;
    const hostname = window.location.hostname;
    
    // GitHub
    if (hostname.includes('github.com') && url.includes('/blob/')) return true;
    // GitLab
    if (hostname.includes('gitlab.com') && url.includes('/-/blob/')) return true;
    // Bitbucket
    if (hostname.includes('bitbucket.org') && url.includes('/src/')) return true;
    // Generic: check for code-like elements
    if (document.querySelector('pre code, .blob-code, .code-wrapper, .file-content')) return true;
    
    return false;
  }
  
  // Generic code file extraction for any platform
  function extractCodeFile(opts) {
    let codeContent = '';
    let codeElement = null;
    
    // GitHub-specific extraction (different structure)
    if (window.location.hostname.includes('github.com')) {
      // GitHub uses a table with line numbers and code
      const codeLines = document.querySelectorAll('table[data-hpc] tr .blob-code-inner, td.blob-code-inner');
      if (codeLines.length > 0) {
        codeLines.forEach(line => {
          codeContent += line.textContent + '\n';
        });
        codeElement = codeLines[0];
      } else {
        // Try alternative GitHub structure
        const blobCode = document.querySelector('.blob-code');
        if (blobCode) {
          codeContent = blobCode.textContent;
          codeElement = blobCode;
        }
      }
    } else {
      // GitLab, Bitbucket, and other platforms
      const codeSelectors = [
        // GitLab
        '.file-content pre code',
        '.blob-viewer pre',
        // Bitbucket
        '.file-source pre',
        '.diff-content-container pre',
        // Generic
        'pre code',
        'pre.code',
        '.code-block',
        'code.hljs',
      ];
      
      // Try each selector
      for (const selector of codeSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          codeElement = element;
          codeContent = element.textContent;
          break;
        }
      }
    }
    
    // Fallback: try to find any pre or code element
    if (!codeContent) {
      codeElement = document.querySelector('pre') || document.querySelector('code');
      if (codeElement) {
        codeContent = codeElement.textContent;
      }
    }
    
    if (!codeContent) {
      // Couldn't find code, fall back to regular extraction
      return null;
    }
    
    // Get file name/path
    let fileName = 'Code';
    const titleElement = document.querySelector('title');
    if (titleElement) {
      const titleText = titleElement.textContent;
      // Extract filename from title
      const match = titleText.match(/([^/\\]+\.\w+)/);
      if (match) fileName = match[1];
    }
    
    // Try to get from URL
    const urlParts = window.location.pathname.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    if (lastPart && lastPart.includes('.')) {
      fileName = lastPart;
    }
    
    // Detect language from filename
    const fileExt = fileName.split('.').pop().toLowerCase();
    const langMap = {
      'js': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'jsx': 'javascript',
      'py': 'python',
      'rb': 'ruby',
      'ex': 'elixir',
      'exs': 'elixir',
      'eex': 'elixir',
      'heex': 'elixir',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'sh': 'bash',
      'bash': 'bash',
      'yml': 'yaml',
      'yaml': 'yaml',
      'json': 'json',
      'md': 'markdown',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sql': 'sql',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin',
    };
    const language = langMap[fileExt] || fileExt;
    
    // Build markdown
    let markdown = '';
    
    if (opts.includeMetadata) {
      markdown += `# ${fileName}\n\n`;
      markdown += `**Source:** [${window.location.href}](${window.location.href})  \n`;
      markdown += `**Imported:** ${new Date().toISOString().split('T')[0]}\n\n`;
      markdown += `---\n\n`;
    }
    
    markdown += `\`\`\`${language}\n`;
    markdown += codeContent.trim();
    markdown += `\n\`\`\`\n`;
    
    return markdown;
  }
  
  return htmlToMarkdown(document.documentElement.innerHTML, options);
}


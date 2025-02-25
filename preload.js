// preload.js

//npm install --save-dev electron
//npm install highlight.js
//npm install marked
//npm install marked-highlight

const { contextBridge, ipcRenderer } = require('electron');
const { Marked } = require("marked");
const { markedHighlight } = require("marked-highlight");
const hljs = require("highlight.js");
const DOMPurify = require('dompurify');
const { executeQuery, executeSelectQuery } = require('./utils/funcs_sqlite');

//========================================================================================
function htmlEncode(text) {
  return text.replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#39;");
}

function htmlDecode(text) {
  return text.replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'")
             .replace(/&lt;/g, "<")
             .replace(/&gt;/g, ">")
             .replace(/&amp;/g, "&");
}

// Assuming sanitizeHTML is defined somewhere
function sanitizeHTML(input) {
  // Configure DOMPurify to prevent sanitizing buttons and other elements from the code blocks
  const config = {
    ALLOWED_TAGS: ['b', 'p', 'i', 'br', 'em', 'strong', 'a', 'code', 'pre', 'div', 'span'], // Whitelist allowed tags
    ALLOWED_ATTR: ['href', 'class', 'style'], // Allow common attributes for safe elements
    //FORBID_TAGS: ['button'], // Block button elements to avoid dangerous <button> tags
    //FORBID_ATTR: ['onclick'] // Block dangerous attributes like onclick
  };

  // Sanitize the HTML except for the code blocks
  return DOMPurify.sanitize(input, config);
}

// Wrap a method with sanitizeHTML
function sanitizeWrapper(fn) {
  return function(...args) {
      return sanitizeHTML(fn.apply(this, args));
  };
}

//========================================================================================

const marked = new Marked(
    markedHighlight({
      async: false, // Set to false for synchronous behavior
      highlight(code, lang) {
        try {
          const validLang = hljs.getLanguage(lang) ? lang : "plaintext";
          const highlightedCode = hljs.highlight(code, { language: validLang }).value;
          return highlightedCode;
        } catch (err) {
          console.error("Error highlighting code:", err);
          return code; // Fall back to plain text if highlighting fails
        }
      }
    })
  );
  

// Create a custom renderer to wrap the <pre><code> block with additional HTML
// Override the code rendering method
const renderer = new marked.Renderer();

// Block-Level Renderers
renderer.space = sanitizeWrapper( renderer.space );
renderer.blockquote = sanitizeWrapper( renderer.blockquote );
renderer.html = sanitizeWrapper( renderer.html );
renderer.heading = sanitizeWrapper( renderer.heading );
renderer.hr = sanitizeWrapper( renderer.hr );
renderer.list = sanitizeWrapper( renderer.list );
renderer.listitem = sanitizeWrapper( renderer.listitem );
renderer.checkbox = sanitizeWrapper( renderer.checkbox );
renderer.paragraph = sanitizeWrapper( renderer.paragraph );
renderer.table = sanitizeWrapper( renderer.table );
renderer.tablerow = sanitizeWrapper( renderer.tablerow );
renderer.tablecell = sanitizeWrapper( renderer.tablecell );

// Inline-Level Renderers
renderer.strong = sanitizeWrapper( renderer.strong );
renderer.em = sanitizeWrapper( renderer.em );
renderer.codespan = sanitizeWrapper( renderer.codespan );
renderer.br = sanitizeWrapper( renderer.br );
renderer.del = sanitizeWrapper( renderer.del );
renderer.link = sanitizeWrapper( renderer.link );
renderer.image = sanitizeWrapper( renderer.image );
renderer.text = sanitizeWrapper( renderer.text );

renderer.code = function(text, lang, escaped) {
  const uniqueId = `code-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

  const other = {
    endingNewline: /\n$/,
  }

  let code = text.text.replace(other.endingNewline, '') + '\n';

  if (!text.lang) {
    return `
    <div style="position: relative;">
      <button class="cpy-btn noselect" onclick="copyToClipboard(this,'${uniqueId}')">Copy</button>
      <pre><code id="${uniqueId}">${code}</code></pre>
    </div>`;
  }

  else {
    return `
    <div style="position: relative;">
      <div class="code-label noselect">${escape(text.lang)}</div>
      <button class="cpy-btn noselect" onclick="copyToClipboard(this,'${uniqueId}')">Copy</button>
      <pre><code id="${uniqueId}" class="language-${escape(text.lang)}">${code}</code></pre>
    </div>`;
  }
  

};

// Apply the custom renderer to `marked`
marked.setOptions({
  renderer: renderer
});

//========================================================================================
// EXPOSED APIs

contextBridge.exposeInMainWorld('markdownAPI', {
  renderMarkdown: (content) => marked.parse(content),
});

// Expose database functions
contextBridge.exposeInMainWorld('dbAPI', {
    executeQuery,
    executeSelectQuery,
});

// Expose Electron APIs
contextBridge.exposeInMainWorld('electronAPI', {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, callback) =>
        ipcRenderer.on(channel, (_, ...args) => callback(...args)),
});

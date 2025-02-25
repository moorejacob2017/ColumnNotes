// preload.js

//npm install --save-dev electron
//npm install highlight.js
//npm install marked
//npm install marked-highlight

const { contextBridge, ipcRenderer } = require('electron');
const { Marked } = require("marked");
const { markedHighlight } = require("marked-highlight");
const hljs = require("highlight.js");
const { executeQuery, executeSelectQuery } = require('./utils/funcs_sqlite');


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

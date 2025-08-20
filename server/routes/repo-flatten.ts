import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { simpleGit } from 'simple-git'
import { marked } from 'marked'
import hljs from 'highlight.js'
import * as fsSync from 'fs'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { z } from 'zod'

// Configuration constants
const MAX_DEFAULT_BYTES = 50 * 1024 // 50 KiB
const BINARY_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico',
    '.pdf', '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
    '.mp3', '.mp4', '.mov', '.avi', '.mkv', '.wav', '.ogg', '.flac',
    '.ttf', '.otf', '.eot', '.woff', '.woff2',
    '.so', '.dll', '.dylib', '.class', '.jar', '.exe', '.bin'
])
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mkdn'])

interface RenderDecision {
    include: boolean
    reason: 'ok' | 'binary' | 'too_large' | 'ignored'
}

interface FileInfo {
    path: string
    rel: string
    size: number
    decision: RenderDecision
}

const requestSchema = z.object({
    repoUrl: z.string().url(),
    maxBytes: z.number().optional().default(MAX_DEFAULT_BYTES)
})

function bytesHuman(n: number): string {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
    let f = n
    let i = 0
    while (f >= 1024.0 && i < units.length - 1) {
        f /= 1024.0
        i++
    }
    if (i === 0) {
        return `${Math.floor(f)} ${units[i]}`
    } else {
        return `${f.toFixed(1)} ${units[i]}`
    }
}

async function looksBinary(filePath: string): Promise<boolean> {
    const ext = path.extname(filePath).toLowerCase()
    if (BINARY_EXTENSIONS.has(ext)) {
        return true
    }

    try {
        const buffer = await fs.readFile(filePath)
        const chunk = buffer.subarray(0, 8192)

        // Check for null bytes
        if (chunk.includes(0)) {
            return true
        }

        // Try UTF-8 decode
        try {
            chunk.toString('utf-8')
            return false
        } catch {
            return true
        }
    } catch {
        return true
    }
}

async function decideFile(filePath: string, repoRoot: string, maxBytes: number): Promise<FileInfo> {
    const rel = path.relative(repoRoot, filePath).replace(/\\/g, '/')

    try {
        const stats = await fs.stat(filePath)
        const size = stats.size

        // Ignore VCS and build files
        if (rel.includes('/.git/') || rel.startsWith('.git/')) {
            return { path: filePath, rel, size, decision: { include: false, reason: 'ignored' } }
        }

        if (size > maxBytes) {
            return { path: filePath, rel, size, decision: { include: false, reason: 'too_large' } }
        }

        if (await looksBinary(filePath)) {
            return { path: filePath, rel, size, decision: { include: false, reason: 'binary' } }
        }

        return { path: filePath, rel, size, decision: { include: true, reason: 'ok' } }
    } catch {
        return { path: filePath, rel, size: 0, decision: { include: false, reason: 'ignored' } }
    }
}

async function collectFiles(repoRoot: string, maxBytes: number): Promise<FileInfo[]> {
    const infos: FileInfo[] = []

    async function walkDir(dir: string) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true })

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name)

                if (entry.isSymbolicLink()) {
                    continue
                }

                if (entry.isFile()) {
                    const info = await decideFile(fullPath, repoRoot, maxBytes)
                    infos.push(info)
                } else if (entry.isDirectory()) {
                    await walkDir(fullPath)
                }
            }
        } catch (error) {
            // Skip directories we can't read
        }
    }

    await walkDir(repoRoot)
    return infos.sort((a, b) => a.rel.localeCompare(b.rel))
}

async function generateTreeFallback(rootPath: string): Promise<string> {
    const lines: string[] = []

    async function walk(dirPath: string, prefix: string = '') {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true })
            const filtered = entries.filter(e => e.name !== '.git')
            filtered.sort((a, b) => {
                if (a.isDirectory() !== b.isDirectory()) {
                    return a.isDirectory() ? -1 : 1
                }
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
            })

            for (let i = 0; i < filtered.length; i++) {
                const entry = filtered[i]
                const last = i === filtered.length - 1
                const branch = last ? '└── ' : '├── '
                lines.push(prefix + branch + entry.name)

                if (entry.isDirectory()) {
                    const extension = last ? '    ' : '│   '
                    await walk(path.join(dirPath, entry.name), prefix + extension)
                }
            }
        } catch {
            // Skip directories we can't read
        }
    }

    lines.push(path.basename(rootPath))
    await walk(rootPath)
    return lines.join('\n')
}

async function readTextFile(filePath: string): Promise<string> {
    try {
        return await fs.readFile(filePath, 'utf-8')
    } catch {
        return 'Failed to read file'
    }
}

function renderMarkdown(text: string): string {
    // Simple markdown rendering without syntax highlighting for now
    // The code highlighting will be handled separately in the code sections
    return marked(text) as string
}

function highlightCode(text: string, filename: string): string {
    const ext = path.extname(filename).toLowerCase()
    let language = ''

    // Map extensions to highlight.js language names
    const langMap: Record<string, string> = {
        '.js': 'javascript',
        '.ts': 'typescript',
        '.jsx': 'javascript',
        '.tsx': 'typescript',
        '.py': 'python',
        '.java': 'java',
        '.cpp': 'cpp',
        '.c': 'c',
        '.cs': 'csharp',
        '.php': 'php',
        '.rb': 'ruby',
        '.go': 'go',
        '.rs': 'rust',
        '.sh': 'bash',
        '.yml': 'yaml',
        '.yaml': 'yaml',
        '.json': 'json',
        '.xml': 'xml',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.sql': 'sql'
    }

    language = langMap[ext] || ''

    if (language && hljs.getLanguage(language)) {
        try {
            return hljs.highlight(text, { language }).value
        } catch {
            // Fall through to auto-detection
        }
    }

    return hljs.highlightAuto(text).value
}

function slugify(pathStr: string): string {
    return pathStr.replace(/[^a-zA-Z0-9\-_]/g, '-')
}

function generateCXML(infos: FileInfo[]): string {
    const lines = ['<documents>']
    const rendered = infos.filter(i => i.decision.include)

    for (let index = 0; index < rendered.length; index++) {
        const info = rendered[index]
        lines.push(`<document index="${index + 1}">`)
        lines.push(`<source>${info.rel}</source>`)
        lines.push('<document_content>')

        try {
            const text = fsSync.readFileSync(info.path, 'utf-8')
            lines.push(text)
        } catch {
            lines.push('Failed to read file')
        }

        lines.push('</document_content>')
        lines.push('</document>')
    }

    lines.push('</documents>')
    return lines.join('\n')
}

async function buildHTML(repoUrl: string, repoDir: string, headCommit: string, infos: FileInfo[]): Promise<string> {
    const rendered = infos.filter(i => i.decision.include)
    const skippedBinary = infos.filter(i => i.decision.reason === 'binary')
    const skippedLarge = infos.filter(i => i.decision.reason === 'too_large')
    const skippedIgnored = infos.filter(i => i.decision.reason === 'ignored')
    const totalFiles = rendered.length + skippedBinary.length + skippedLarge.length + skippedIgnored.length

    // Generate directory tree
    const treeText = await generateTreeFallback(repoDir)

    // Generate CXML for LLM view
    const cxmlText = generateCXML(infos)

    // Table of contents
    const tocItems = rendered.map(info => {
        const anchor = slugify(info.rel)
        return `<li><a href="#file-${anchor}">${escapeHtml(info.rel)}</a> <span class="muted">(${bytesHuman(info.size)})</span></li>`
    }).join('')

    // Render file sections
    const sections = await Promise.all(rendered.map(async (info) => {
        const anchor = slugify(info.rel)
        const ext = path.extname(info.path).toLowerCase()

        try {
            const text = await readTextFile(info.path)
            let bodyHtml: string

            if (MARKDOWN_EXTENSIONS.has(ext)) {
                bodyHtml = renderMarkdown(text)
            } else {
                const highlighted = highlightCode(text, info.rel)
                bodyHtml = `<div class="highlight"><pre><code>${highlighted}</code></pre></div>`
            }

            return `<section class="file-section" id="file-${anchor}">
        <h2>${escapeHtml(info.rel)} <span class="muted">(${bytesHuman(info.size)})</span></h2>
        <div class="file-body">${bodyHtml}</div>
        <div class="back-top"><a href="#top">↑ Back to top</a></div>
      </section>`
        } catch {
            return `<section class="file-section" id="file-${anchor}">
        <h2>${escapeHtml(info.rel)} <span class="muted">(${bytesHuman(info.size)})</span></h2>
        <div class="file-body"><pre class="error">Failed to render file</pre></div>
        <div class="back-top"><a href="#top">↑ Back to top</a></div>
      </section>`
        }
    }))

    // Skip lists
    const renderSkipList = (title: string, items: FileInfo[]) => {
        if (items.length === 0) return ''
        const listItems = items.map(item =>
            `<li><code>${escapeHtml(item.rel)}</code> <span class='muted'>(${bytesHuman(item.size)})</span></li>`
        ).join('\n')
        return `<details open><summary>${escapeHtml(title)} (${items.length})</summary>
      <ul class='skip-list'>${listItems}</ul></details>`
    }

    const skippedHtml = renderSkipList('Skipped binaries', skippedBinary) +
        renderSkipList('Skipped large files', skippedLarge)

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Flattened repo – ${escapeHtml(repoUrl)}</title>
  <style>
    ${getCSS()}
  </style>
</head>
<body>
  <a id="top"></a>
  <div class="page">
    <nav id="sidebar">
      <div class="sidebar-inner">
        <h2>Contents (${rendered.length})</h2>
        <ul class="toc toc-sidebar">
          <li><a href="#top">↑ Back to top</a></li>
          ${tocItems}
        </ul>
      </div>
    </nav>
    <main class="container">
      <section>
        <div class="meta">
          <div><strong>Repository:</strong> <a href="${escapeHtml(repoUrl)}">${escapeHtml(repoUrl)}</a></div>
          <small><strong>HEAD commit:</strong> ${escapeHtml(headCommit)}</small>
          <div class="counts">
            <strong>Total files:</strong> ${totalFiles} · 
            <strong>Rendered:</strong> ${rendered.length} · 
            <strong>Skipped:</strong> ${skippedBinary.length + skippedLarge.length + skippedIgnored.length}
          </div>
        </div>
      </section>
      
      <div class="view-toggle">
        <strong>View:</strong>
        <button class="toggle-btn active" id="human-view-btn" type="button">👤 Human</button>
        <button class="toggle-btn" id="llm-view-btn" type="button">🤖 LLM</button>
      </div>
      
      <div id="human-view">
        <section>
          <h2>Directory tree</h2>
          <pre>${escapeHtml(treeText)}</pre>
        </section>
        
        <section class="toc-top">
          <h2>Table of contents (${rendered.length})</h2>
          <ul class="toc">${tocItems}</ul>
        </section>
        
        <section>
          <h2>Skipped items</h2>
          ${skippedHtml}
        </section>
        
        ${sections.join('')}
      </div>
      
      <div id="llm-view">
        <section>
          <h2>🤖 LLM View - CXML Format</h2>
          <p>Copy the text below and paste it to an LLM for analysis:</p>
          <textarea id="llm-text" readonly>${escapeHtml(cxmlText)}</textarea>
          <div class="copy-hint">💡 <strong>Tip:</strong> Click in the text area and press Ctrl+A (Cmd+A on Mac) to select all, then Ctrl+C (Cmd+C) to copy.</div>
        </section>
      </div>
    </main>
  </div>
  
  <script>
    // CSP-compliant JavaScript with proper event listeners
    (function() {
      'use strict';
      
      function showHumanView() {
        const humanView = document.getElementById('human-view');
        const llmView = document.getElementById('llm-view');
        const humanBtn = document.getElementById('human-view-btn');
        const llmBtn = document.getElementById('llm-view-btn');
        
        if (humanView) humanView.style.display = 'block';
        if (llmView) llmView.style.display = 'none';
        if (humanBtn) humanBtn.classList.add('active');
        if (llmBtn) llmBtn.classList.remove('active');
      }
      
      function showLLMView() {
        const humanView = document.getElementById('human-view');
        const llmView = document.getElementById('llm-view');
        const humanBtn = document.getElementById('human-view-btn');
        const llmBtn = document.getElementById('llm-view-btn');
        
        if (humanView) humanView.style.display = 'none';
        if (llmView) llmView.style.display = 'block';
        if (humanBtn) humanBtn.classList.remove('active');
        if (llmBtn) llmBtn.classList.add('active');
        
        // Auto-select LLM text after a short delay
        setTimeout(function() {
          const textArea = document.getElementById('llm-text');
          if (textArea) {
            try {
              textArea.focus();
              textArea.select();
            } catch (e) {
              // Ignore focus/select errors in some browsers
              console.log('Could not auto-select text:', e.message);
            }
          }
        }, 100);
      }
      
      // Initialize when DOM is ready
      function initialize() {
        // Set up event listeners
        const humanBtn = document.getElementById('human-view-btn');
        const llmBtn = document.getElementById('llm-view-btn');
        
        if (humanBtn) {
          humanBtn.addEventListener('click', showHumanView);
        }
        
        if (llmBtn) {
          llmBtn.addEventListener('click', showLLMView);
        }
        
        // Ensure human view is shown by default
        showHumanView();
        
        console.log('Repo flattener initialized successfully');
      }
      
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
      } else {
        initialize();
      }
    })();
  </script>
</body>
</html>`
}

function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }
    return text.replace(/[&<>"']/g, (m) => map[m])
}

function getCSS(): string {
    return `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji';
      margin: 0; padding: 0; line-height: 1.45;
    }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 1rem; }
    .meta small { color: #666; }
    .counts { margin-top: 0.25rem; color: #333; }
    .muted { color: #777; font-weight: normal; font-size: 0.9em; }
    
    .page { display: grid; grid-template-columns: 320px minmax(0,1fr); gap: 0; }
    #sidebar {
      position: sticky; top: 0; align-self: start;
      height: 100vh; overflow: auto;
      border-right: 1px solid #eee; background: #fafbfc;
    }
    #sidebar .sidebar-inner { padding: 0.75rem; }
    #sidebar h2 { margin: 0 0 0.5rem 0; font-size: 1rem; }
    .toc { list-style: none; padding-left: 0; margin: 0; overflow-x: auto; }
    .toc li { padding: 0.15rem 0; white-space: nowrap; }
    .toc a { text-decoration: none; color: #0366d6; display: inline-block; }
    .toc a:hover { text-decoration: underline; }
    
    main.container { padding-top: 1rem; }
    pre { background: #f6f8fa; padding: 0.75rem; overflow: auto; border-radius: 6px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }
    .highlight { overflow-x: auto; }
    .file-section { padding: 1rem; border-top: 1px solid #eee; }
    .file-section h2 { margin: 0 0 0.5rem 0; font-size: 1.1rem; }
    .file-body { margin-bottom: 0.5rem; }
    .back-top { font-size: 0.9rem; }
    .skip-list code { background: #f6f8fa; padding: 0.1rem 0.3rem; border-radius: 4px; }
    .error { color: #b00020; background: #fff3f3; }
    
    .toc-top { display: block; }
    @media (min-width: 1000px) { .toc-top { display: none; } }
    :target { scroll-margin-top: 8px; }
    
    .view-toggle { margin: 1rem 0; display: flex; gap: 0.5rem; align-items: center; }
    .toggle-btn {
      padding: 0.5rem 1rem; border: 1px solid #d1d9e0; background: white; cursor: pointer;
      border-radius: 6px; font-size: 0.9rem;
    }
    .toggle-btn.active { background: #0366d6; color: white; border-color: #0366d6; }
    .toggle-btn:hover:not(.active) { background: #f6f8fa; }
    
    #llm-view { display: none; }
    #llm-text {
      width: 100%; height: 70vh;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85em; border: 1px solid #d1d9e0; border-radius: 6px;
      padding: 1rem; resize: vertical;
    }
    .copy-hint { margin-top: 0.5rem; color: #666; font-size: 0.9em; }
    
    /* Highlight.js styles */
    .hljs { display: block; overflow-x: auto; padding: 0.5em; background: #f6f8fa; }
    .hljs-comment, .hljs-quote { color: #6a737d; }
    .hljs-keyword, .hljs-selector-tag, .hljs-subst { color: #d73a49; }
    .hljs-number, .hljs-literal, .hljs-variable, .hljs-template-variable, .hljs-tag .hljs-attr { color: #005cc5; }
    .hljs-string, .hljs-doctag { color: #032f62; }
    .hljs-title, .hljs-section, .hljs-selector-id { color: #6f42c1; }
    .hljs-type, .hljs-class .hljs-title { color: #d73a49; }
    .hljs-tag, .hljs-name, .hljs-attribute { color: #22863a; }
    .hljs-regexp, .hljs-link { color: #032f62; }
    .hljs-symbol, .hljs-bullet { color: #e36209; }
    .hljs-built_in, .hljs-builtin-name { color: #005cc5; }
    .hljs-meta { color: #6a737d; }
    .hljs-deletion { background: #ffeef0; }
    .hljs-addition { background: #f0fff4; }
    .hljs-emphasis { font-style: italic; }
    .hljs-strong { font-weight: bold; }
  `
}

export async function registerRepoFlattenRoutes(server: FastifyInstance) {
    server.post('/api/repo-flatten', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const { repoUrl, maxBytes } = requestSchema.parse(request.body)

            // Create temporary directory
            const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flatten-repo-'))
            const repoDir = path.join(tmpDir, 'repo')

            try {
                server.log.info(`Cloning ${repoUrl} to ${repoDir}`)

                // Clone the repository
                const git = simpleGit()
                await git.clone(repoUrl, repoDir, ['--depth', '1'])

                // Get HEAD commit
                const repoGit = simpleGit(repoDir)
                const headCommit = await repoGit.revparse(['HEAD'])

                server.log.info(`Clone complete (HEAD: ${headCommit.substring(0, 8)})`)

                // Scan files
                server.log.info(`Scanning files in ${repoDir}`)
                const infos = await collectFiles(repoDir, maxBytes)

                const renderedCount = infos.filter(i => i.decision.include).length
                const skippedCount = infos.length - renderedCount

                server.log.info(`Found ${infos.length} files total (${renderedCount} will be rendered, ${skippedCount} skipped)`)

                // Generate HTML
                server.log.info('Generating HTML')
                const html = await buildHTML(repoUrl, repoDir, headCommit, infos)

                reply.type('text/html')
                return html

            } finally {
                // Cleanup temporary directory
                try {
                    await fs.rm(tmpDir, { recursive: true, force: true })
                } catch (error) {
                    server.log.warn(`Failed to cleanup temp directory ${tmpDir}: ${error}`)
                }
            }

        } catch (error) {
            server.log.error(error)

            if (error instanceof z.ZodError) {
                return reply.status(400).send({
                    error: 'Invalid request',
                    details: error.errors
                })
            }

            return reply.status(500).send({
                error: 'Failed to flatten repository',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        }
    })
}
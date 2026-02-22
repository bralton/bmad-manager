<script lang="ts">
  import { marked } from 'marked';
  import hljs from 'highlight.js';

  let { content }: { content: string } = $props();

  // Configure marked with syntax highlighting
  marked.setOptions({
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Convert line breaks to <br>
  });

  // Custom renderer with syntax highlighting for code blocks
  const renderer = new marked.Renderer();
  renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
    const highlighted = hljs.highlight(text, { language }).value;
    return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
  };

  marked.use({ renderer });

  // Parse markdown to HTML
  let html = $derived(marked.parse(content) as string);
</script>

<div class="markdown-content prose prose-invert prose-sm max-w-none">
  {@html html}
</div>

<style>
  /* Custom markdown styling for dark theme */
  .markdown-content :global(h1) {
    font-size: 1.25rem;
    font-weight: 700;
    color: white;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgb(55 65 81);
  }

  .markdown-content :global(h2) {
    font-size: 1.125rem;
    font-weight: 600;
    color: white;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }

  .markdown-content :global(h3) {
    font-size: 1rem;
    font-weight: 600;
    color: rgb(209 213 219);
    margin-top: 1.25rem;
    margin-bottom: 0.5rem;
  }

  .markdown-content :global(h4),
  .markdown-content :global(h5),
  .markdown-content :global(h6) {
    font-size: 0.875rem;
    font-weight: 600;
    color: rgb(156 163 175);
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }

  .markdown-content :global(p) {
    color: rgb(209 213 219);
    margin-bottom: 0.75rem;
    line-height: 1.6;
  }

  .markdown-content :global(a) {
    color: rgb(96 165 250);
    text-decoration: underline;
  }

  .markdown-content :global(a:hover) {
    color: rgb(147 197 253);
  }

  .markdown-content :global(ul),
  .markdown-content :global(ol) {
    color: rgb(209 213 219);
    margin-bottom: 0.75rem;
    padding-left: 1.5rem;
  }

  .markdown-content :global(ul) {
    list-style-type: disc;
  }

  .markdown-content :global(ol) {
    list-style-type: decimal;
  }

  .markdown-content :global(li) {
    margin-bottom: 0.25rem;
  }

  .markdown-content :global(li ul),
  .markdown-content :global(li ol) {
    margin-top: 0.25rem;
    margin-bottom: 0;
  }

  /* Checkbox styling for task lists */
  .markdown-content :global(input[type="checkbox"]) {
    margin-right: 0.5rem;
    accent-color: rgb(59 130 246);
  }

  .markdown-content :global(blockquote) {
    border-left: 3px solid rgb(75 85 99);
    padding-left: 1rem;
    color: rgb(156 163 175);
    font-style: italic;
    margin-bottom: 0.75rem;
  }

  .markdown-content :global(code) {
    background-color: rgb(31 41 55);
    color: rgb(253 186 116);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.875em;
  }

  .markdown-content :global(pre) {
    background-color: rgb(31 41 55);
    border: 1px solid rgb(55 65 81);
    border-radius: 0.5rem;
    padding: 1rem;
    overflow-x: auto;
    margin-bottom: 1rem;
  }

  .markdown-content :global(pre code) {
    background-color: transparent;
    padding: 0;
    color: rgb(229 231 235);
    font-size: 0.8125rem;
    line-height: 1.5;
  }

  /* Highlight.js syntax highlighting - GitHub Dark theme */
  .markdown-content :global(.hljs-keyword),
  .markdown-content :global(.hljs-selector-tag),
  .markdown-content :global(.hljs-built_in) {
    color: #ff7b72;
  }

  .markdown-content :global(.hljs-string),
  .markdown-content :global(.hljs-attr) {
    color: #a5d6ff;
  }

  .markdown-content :global(.hljs-number),
  .markdown-content :global(.hljs-literal) {
    color: #79c0ff;
  }

  .markdown-content :global(.hljs-function),
  .markdown-content :global(.hljs-title) {
    color: #d2a8ff;
  }

  .markdown-content :global(.hljs-comment),
  .markdown-content :global(.hljs-quote) {
    color: #8b949e;
    font-style: italic;
  }

  .markdown-content :global(.hljs-variable),
  .markdown-content :global(.hljs-template-variable) {
    color: #ffa657;
  }

  .markdown-content :global(.hljs-type),
  .markdown-content :global(.hljs-class .hljs-title) {
    color: #7ee787;
  }

  .markdown-content :global(.hljs-params) {
    color: #c9d1d9;
  }

  .markdown-content :global(.hljs-meta) {
    color: #79c0ff;
  }

  .markdown-content :global(.hljs-regexp) {
    color: #7ee787;
  }

  .markdown-content :global(.hljs-symbol) {
    color: #79c0ff;
  }

  .markdown-content :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .markdown-content :global(th),
  .markdown-content :global(td) {
    border: 1px solid rgb(55 65 81);
    padding: 0.5rem 0.75rem;
    text-align: left;
  }

  .markdown-content :global(th) {
    background-color: rgb(31 41 55);
    color: rgb(229 231 235);
    font-weight: 600;
  }

  .markdown-content :global(td) {
    color: rgb(209 213 219);
  }

  .markdown-content :global(tr:nth-child(even) td) {
    background-color: rgb(17 24 39 / 0.5);
  }

  .markdown-content :global(hr) {
    border: none;
    border-top: 1px solid rgb(55 65 81);
    margin: 1.5rem 0;
  }

  .markdown-content :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
  }

  /* Strong and emphasis */
  .markdown-content :global(strong) {
    color: white;
    font-weight: 600;
  }

  .markdown-content :global(em) {
    color: rgb(209 213 219);
    font-style: italic;
  }
</style>

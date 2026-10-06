// each case renders fixtures/<input> with these plugin options and compares to fixtures/<name>.html
export const CASES = [
  { name: 'default', input: 'blocks.md', shell: undefined, blocks: undefined },
  { name: 'no-copy-title-bottom', input: 'blocks.md', shell: { prompt: '> ' }, blocks: { copyButton: false, title: { position: 'bottom' } } },
  { name: 'exclude-json', input: 'blocks.md', shell: undefined, blocks: { excludeLangs: ['json', 'mermaid'] } },
];

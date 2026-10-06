/**
 * Unified rehype plugin for code block enhancement.
 *
 * Replaces Astro's built-in Prism integration. Use with syntaxHighlight: false.
 *
 * Meta string syntax:
 *   ```js {2,4-6}           -- highlight lines 2, 4, 5, 6
 *   ```json [3-5]           -- collapse lines 3-5 (hidden by default, toggle to expand)
 *   ```bash diff            -- diff overlay (lines starting with + or - get color backgrounds)
 *   ```ts title="app.ts"   -- file name tab above the block
 *   combinations are fine: ```js {1} [3-5] title="example.js"
 */

import { visit } from 'unist-util-visit';
import { toText } from 'hast-util-to-text';
import { DEFAULT_EXCLUDE, buildCodeBlock, getLanguage, getMeta } from './core.mjs';

/**
 * @param {object} opts
 * @param {string[]} [opts.excludeLangs=['mermaid']] - languages to skip (no highlighting, no wrapping)
 * @param {boolean} [opts.copyButton=true] - wrap pre blocks with a copy-code-button custom element
 * @param {{ position?: 'top' | 'bottom' }} [opts.title={ position: 'top' }] - title tab options
 */
export function rehypeCodeBlocks({
  excludeLangs = DEFAULT_EXCLUDE,
  copyButton = true,
  title: titleOpts = { position: 'top' },
} = {}) {
  const titlePosition = titleOpts?.position ?? 'top';

  return async (tree) => {
    const tasks = [];

    // Collect pre elements (gives us preParent + preIndex for replacement)
    visit(tree, { type: 'element', tagName: 'pre' }, (preNode, preIndex, preParent) => {
      const codeChild = preNode.children?.find(c => c.tagName === 'code');
      if (!codeChild) return;

      const language = getLanguage(codeChild);

      if (excludeLangs.includes(language)) return;

      const meta = getMeta(codeChild);
      const code = toText(codeChild, { whitespace: 'pre' });

      tasks.push({ preNode, preIndex, preParent, language, meta, code });
    });

    for (const { preIndex, preParent, language, meta, code } of tasks) {
      preParent.children.splice(preIndex, 1, await buildCodeBlock({ language, meta, code }, { copyButton, titlePosition }));
    }
  };
}

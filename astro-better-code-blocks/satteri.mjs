/**
 * Sätteri plugins for code block enhancement. Same output as the unified
 * `remarkShellSession` and `rehypeCodeBlocks`; see core.mjs for the shared logic.
 *
 *   import { satteri } from '@astrojs/markdown-satteri';
 *   import { shellSession, codeBlocks } from 'astro-better-code-blocks/satteri';
 *
 *   satteri({
 *     mdastPlugins: [shellSession()],
 *     hastPlugins: [codeBlocks({ excludeLangs: ['mermaid'] })],
 *   });
 */

import { toText } from 'hast-util-to-text';
import { DEFAULT_EXCLUDE, addShellPrompts, buildCodeBlock, getLanguage, getMeta } from './core.mjs';

/**
 * mdast plugin: prepend prompts to unprompted shell-session lines.
 * @param {object} [opts]
 * @param {string} [opts.prompt='$ '] - default prompt to prepend to unprompted lines
 */
export function shellSession({ prompt = '$ ' } = {}) {
  return {
    name: 'astro-better-code-blocks:shell-session',
    code(node, ctx) {
      if (node.lang !== 'shell-session') return;
      const value = addShellPrompts(node.value, prompt);
      if (value !== node.value) ctx.setProperty(node, 'value', value);
    },
  };
}

/**
 * hast plugin: highlight `pre > code` blocks and add line meta, copy button, and title.
 * @param {object} [opts]
 * @param {string[]} [opts.excludeLangs=['mermaid']] - languages to skip (no highlighting, no wrapping)
 * @param {boolean} [opts.copyButton=true] - wrap pre blocks with a copy-code-button custom element
 * @param {{ position?: 'top' | 'bottom' }} [opts.title={ position: 'top' }] - title tab options
 */
export function codeBlocks({
  excludeLangs = DEFAULT_EXCLUDE,
  copyButton = true,
  title: titleOpts = { position: 'top' },
} = {}) {
  const titlePosition = titleOpts?.position ?? 'top';

  // a factory runs once per document; chaining keeps that document's blocks in order
  return () => {
    let previous = Promise.resolve();
    return {
      name: 'astro-better-code-blocks:code-blocks',
      element: {
        filter: ['pre'],
        visit(preNode) {
          const codeChild = preNode.children?.find(c => c.tagName === 'code');
          if (!codeChild) return;

          const language = getLanguage(codeChild);
          if (excludeLangs.includes(language)) return;

          const meta = getMeta(codeChild);
          const code = toText(codeChild, { whitespace: 'pre' });

          // one block at a time, as in the unified plugin: Prism loads grammars lazily,
          // and overlapping loads can leave different grammars than sequential ones
          const next = previous.then(() => buildCodeBlock({ language, meta, code }, { copyButton, titlePosition }));
          previous = next.catch(() => {});
          // returning the node replaces the pre in place
          return next;
        },
      },
    };
  };
}

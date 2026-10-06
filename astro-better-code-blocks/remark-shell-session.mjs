/**
 * Remark plugin that normalizes shell-session code blocks.
 * Lines without a prompt prefix get "$ " prepended so Prism's shell-session
 * grammar can tokenize and style them correctly.
 *
 * Only runs at build time -- no client-side script involved.
 * The copy button skips prompt tokens via data-no-copy (set by rehypeCodeBlocks).
 */

import { visit } from 'unist-util-visit';
import { addShellPrompts } from './core.mjs';

/**
 * @param {object} [opts]
 * @param {string} [opts.prompt='$ '] - default prompt to prepend to unprompted lines
 */
export function remarkShellSession({ prompt = '$ ' } = {}) {
  return (tree) => {
    visit(tree, 'code', (node) => {
      if (node.lang !== 'shell-session') return;
      node.value = addShellPrompts(node.value, prompt);
    });
  };
}

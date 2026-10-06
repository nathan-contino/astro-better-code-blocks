// regenerate snapshots from a given implementation dir: node test/gen-snapshots.mjs <dir>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { CASES } from './cases.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const impl = path.resolve(process.argv[2] ?? path.join(here, '..'));
const { rehypeCodeBlocks } = await import(pathToFileURL(path.join(impl, 'rehype-code-blocks.mjs')));
const { remarkShellSession } = await import(pathToFileURL(path.join(impl, 'remark-shell-session.mjs')));

for (const c of CASES) {
  const src = fs.readFileSync(path.join(here, 'fixtures', c.input), 'utf8');
  const file = await unified().use(remarkParse).use(remarkShellSession, c.shell).use(remarkRehype)
    .use(rehypeCodeBlocks, c.blocks).use(rehypeStringify).process(src);
  fs.writeFileSync(path.join(here, 'fixtures', `${c.name}.html`), String(file));
  console.log('wrote', c.name);
}

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEFAULT_IGNORE = [
  'node_modules', 'vendor', '.gitignore', '.DS_Store',
  'package*.json', '*.lock', 'repositoryUrl.txt',
  'tests', 'LICENSE', 'SECURITY.md',
];

function hashDir(sourcePath) {
  const hash = createHash('sha256');
  function walk(dir) {
    const entries = readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.isSymbolicLink()) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        hash.update(full.slice(sourcePath.length));
        hash.update(readFileSync(full));
      }
    }
  }
  walk(sourcePath);
  return hash.digest('hex');
}

function countFiles(dir, exclude) {
  let n = 0;
  function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (full !== exclude) n++;
    }
  }
  try { walk(dir); } catch { /* dir may not exist yet */ }
  return n;
}

function pruneEmptyDirs(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const full = join(dir, e.name);
    pruneEmptyDirs(full);
    if (readdirSync(full).length === 0) rmSync(full, { recursive: true });
  }
}

function filterOutput(raw) {
  return raw.split('\n')
    .filter(l => !l.includes('parsed file') && !l.includes('found binary file'))
    .join('\n')
    .trim();
}

/**
 * Astro integration: runs `bluehawk snip` on each subdirectory of sourceDir
 * and writes generated snippets to outputDir. Skips if source content is unchanged.
 *
 * @param {object} [opts]
 * @param {string} [opts.sourceDir='extractedcode'] - directory of tested source projects, relative to project root
 * @param {string} [opts.outputDir='src/generated-code-snippets'] - where generated snippets land
 * @param {string[]} [opts.ignore] - patterns forwarded to bluehawk --ignore
 * @param {string} [opts.plugin] - optional bluehawk plugin path (relative to project root)
 */
export function extractedCodeSnippets({
  sourceDir = 'extractedcode',
  outputDir = 'src/generated-code-snippets',
  ignore = DEFAULT_IGNORE,
  plugin,
} = {}) {
  return {
    name: 'astro-better-code-snippet-extractor',
    hooks: {
      'astro:config:done': ({ logger }) => {
        const root = process.cwd();
        const sourcePath = resolve(root, sourceDir);
        const outputPath = resolve(root, outputDir);
        const hashFile = join(outputPath, '.snippets-hash');

        if (!existsSync(sourcePath)) {
          logger.warn(`source directory not found: ${sourcePath} -- skipping snippet generation`);
          return;
        }

        mkdirSync(outputPath, { recursive: true });

        const currentHash = hashDir(sourcePath);
        const snippetCount = countFiles(outputPath, hashFile);

        if (
          existsSync(hashFile) &&
          readFileSync(hashFile, 'utf-8').trim() === currentHash &&
          snippetCount > 0
        ) {
          logger.info(`snippets up to date (${snippetCount} files)`);
          return;
        }

        const dirs = readdirSync(sourcePath, { withFileTypes: true })
          .filter(e => e.isDirectory())
          .map(e => e.name);

        if (dirs.length === 0) {
          logger.warn(`no subdirectories found in ${sourcePath}`);
          return;
        }

        let totalWritten = 0;

        for (const dir of dirs) {
          const dirPath = join(sourcePath, dir);
          const dirOutput = join(outputPath, dir);
          mkdirSync(dirOutput, { recursive: true });

          const args = ['--yes', 'bluehawk', 'snip', dirPath, '--output', dirOutput];
          if (plugin) args.push('--plugin', plugin);
          for (const pattern of ignore) args.push('--ignore', pattern);

          // NODE_ENV=development causes bluehawk to include .ts in its extension list,
          // which matches .d.ts files; Node 22.6+ then fails when trying to strip types
          // from .d.ts files in node_modules.
          const spawnEnv = { ...process.env };
          delete spawnEnv.NODE_ENV;
          const result = spawnSync('npx', args, { encoding: 'utf-8', cwd: root, env: spawnEnv });
          const stdout = result.stdout || '';
          const stderr = result.stderr || '';

          if (result.status !== 0 || (stdout + stderr).includes('bluehawk errors')) {
            throw new Error(
              `bluehawk snip failed for "${dir}":\n${filterOutput(stdout + stderr)}`
            );
          }

          totalWritten += (stdout.match(/wrote text file/g) || []).length;
        }

        pruneEmptyDirs(outputPath);
        writeFileSync(hashFile, currentHash);
        logger.info(`${totalWritten} snippet${totalWritten !== 1 ? 's' : ''} written`);
      },
    },
  };
}

import { cp, mkdir, rm, access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
// Allowlist public assets; never copy the provided local reference fonts.
for (const name of ['index.html', 'style.css', '.nojekyll', 'src', 'vendor', 'assets/favicon.svg', 'assets/fonts']) {
  await access(path.join(root, name));
  await mkdir(path.dirname(path.join(dist, name)), { recursive: true });
  await cp(path.join(root, name), path.join(dist, name), { recursive: true });
}
const appPath = path.join(dist, 'src/app.js');
const app = await readFile(appPath, 'utf8');
await writeFile(appPath, app.replace('const LOAD_LOCAL_FONTS = true;', 'const LOAD_LOCAL_FONTS = false;'));
console.log('Built dist/ — static, self-contained, ready for GitHub Pages.');

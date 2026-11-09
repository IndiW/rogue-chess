import { copyFile, mkdir } from 'node:fs/promises';
const name = 'stockfish-17.1-lite-single-03e3232';
const directory = new URL('../public/engine/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const suffix of ['.js', '.wasm']) {
  await copyFile(new URL(`../node_modules/stockfish/src/${name}${suffix}`, import.meta.url), new URL(name + suffix, directory));
}
await copyFile(new URL('../node_modules/stockfish/Copying.txt', import.meta.url), new URL('COPYING.txt', directory));

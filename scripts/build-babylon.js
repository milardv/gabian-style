import {build} from 'esbuild';
import {copyFile,readFile,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
await build({entryPoints:['scripts/babylon-entry.js'],outfile:'public/vendor/babylon/babylon.module.js',bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'eof'});
await copyFile('node_modules/@babylonjs/core/license.md','public/vendor/babylon/LICENSE.md');
await copyFile('node_modules/3d-tiles-renderer/LICENSE','public/vendor/babylon/LICENSE-3d-tiles.txt');
await writeFile('public/vendor/babylon/babylon.module.js.gz',gzipSync(await readFile('public/vendor/babylon/babylon.module.js'),{level:9}));

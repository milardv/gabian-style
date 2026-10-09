import {build} from 'esbuild';
import {copyFile} from 'node:fs/promises';
await build({entryPoints:['scripts/babylon-entry.js'],outfile:'public/vendor/babylon/babylon.module.js',bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'eof'});
await copyFile('node_modules/@babylonjs/core/license.md','public/vendor/babylon/LICENSE.md');

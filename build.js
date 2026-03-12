const esbuild = require('esbuild');
const path = require('path');

esbuild.build({
  entryPoints: [path.join(__dirname, 'background/background.js')],
  bundle: true,
  format: 'esm',
  outfile: path.join(__dirname, 'dist/background.js'),
  platform: 'browser',
  target: 'es2020',
}).catch(() => process.exit(1));

'use strict';

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const JavaScriptObfuscator = require('javascript-obfuscator');

const root = path.resolve(__dirname, '..');

function obfuscate(source, target) {
  const result = JavaScriptObfuscator.obfuscate(source, {
    compact: true,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    selfDefending: false,
    debugProtection: false,
  });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, result.getObfuscatedCode());
}

async function bundle(entry, platform, external = []) {
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    platform,
    format: 'cjs',
    target: platform === 'node' ? 'node18' : 'chrome100',
    external,
    write: false,
    legalComments: 'none',
  });
  return result.outputFiles[0].text;
}

async function main() {
  const extension = await bundle(path.join(root, 'extension.js'), 'node', [
    'vscode', '@8crafter/leveldb-zlib', 'mcbe-leveldb', 'jszip'
  ]);
  obfuscate(extension, path.join(root, 'dist', 'extension.js'));

  const editor = await bundle(path.join(root, 'media', 'voxel-editor.js'), 'browser');
  obfuscate(editor, path.join(root, 'media', 'voxel-editor.bundle.js'));
  console.log('BedrockPy release JavaScript bundled and obfuscated.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

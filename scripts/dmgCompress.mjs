/*global process */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import paths from './projectPaths.mjs';

// Recompress the universal DMG with lzma (ULMO). That makes it about 20%
// smaller than electron-builder's default (UDZO), and electron-builder 26
// does not accept ULMO as its dmg.format. ULMO needs macOS 10.15 or later,
// and Electron 43 already needs macOS 12. This only runs on macOS, since it
// uses hdiutil.

if (process.platform !== 'darwin')
  throw new Error('dmgCompress.mjs uses hdiutil, so it must run on macOS.');

const { releasePath } = paths;
const dmgs = fs
  .readdirSync(releasePath)
  .filter((name) => name.endsWith('-universal.dmg'));
if (!dmgs.length) throw new Error(`No universal DMG found in ${releasePath}`);

dmgs.forEach((name) => {
  const dmg = path.join(releasePath, name);
  const tmp = path.join(releasePath, `${name}.ULMO.dmg`);
  if (fs.existsSync(tmp)) fs.rmSync(tmp);
  const before = fs.statSync(dmg).size;
  console.log(`Recompressing ${name} as ULMO...`);
  execFileSync(
    'hdiutil',
    ['convert', dmg, '-format', 'ULMO', '-o', tmp, '-quiet'],
    { stdio: 'inherit' },
  );
  execFileSync('hdiutil', ['verify', tmp, '-quiet'], { stdio: 'inherit' });
  fs.renameSync(tmp, dmg);
  // The blockmap describes the old file. The DMG is not used for updates,
  // so remove it rather than leave a wrong one next to the DMG.
  const blockmap = `${dmg}.blockmap`;
  if (fs.existsSync(blockmap)) fs.rmSync(blockmap);
  const mb = (n) => Math.round(n / 1000000);
  console.log(`${name}: ${mb(before)} MB -> ${mb(fs.statSync(dmg).size)} MB`);
});

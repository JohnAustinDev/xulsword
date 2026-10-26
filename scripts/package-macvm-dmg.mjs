#! /usr/bin/env node
/*global process */
import fs from 'fs';
import path from 'path';
import { spawnSync, execFileSync } from 'child_process';
import paths from './projectPaths.mjs';

// Build the universal MacOS DMG on a MacOS VM and copy it to build/release.
// The DMG must be built on MacOS (lipo, hdiutil and codesign), while the Mac
// zips used by the auto-updater are built and published from Linux.
//
// Steps:
//   1. Sync this xulsword working tree to the VM with rsync.
//   2. On the VM: source setenv, yarn install, then yarn package-mac-dmg.
//   3. Copy the resulting DMG back to build/release.
//
// Environment variables:
//   MACVM_SSH  SSH host of the VM (default: macvm)
//   MACVM_DIR  xulsword directory on the VM, relative to its home directory
//              (default: src/xulsword)
// On the VM, ~/xulsword-dmg.env is sourced after setenv if it exists. Use it
// for VM-only settings, such as the APPLE_API_KEY, APPLE_API_KEY_ID and
// APPLE_API_ISSUER notarization variables.

const host = process.env.MACVM_SSH || 'macvm';
const remoteDir = process.env.MACVM_DIR || 'src/xulsword';
const { rootPath, releasePath } = paths;

function run(cmd, args) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${cmd} failed with exit code ${result.status}`);
}

// Quote a string for the remote shell.
const quote = (s) => `'${s.replace(/'/g, `'\\''`)}'`;

// Run a command on the VM with bash, since setenv needs bash.
const remote = (script) => run('ssh', [host, `bash -c ${quote(script)}`]);

const start = Date.now();

// The VM must already be running.
try {
  execFileSync(
    'ssh',
    ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, 'true'],
    { stdio: 'ignore' },
  );
} catch {
  throw new Error(
    `Cannot connect to the MacOS VM with 'ssh ${host}'. Is it running?`,
  );
}

// 1. Sync. Excluded paths are not deleted on the VM, so its node_modules,
// yarn cache and build output are kept between runs. The VM has rsync
// 2.6.9, so only old rsync options can be used.
console.log(`Syncing ${rootPath} to ${host}:${remoteDir}`);
remote(`mkdir -p ${quote(remoteDir)}`);
run('rsync', [
  '-a',
  '--delete',
  '--exclude=.git',
  '--exclude=node_modules',
  '--exclude=dist',
  '--exclude=.eslintcache',
  '--exclude=/build/release',
  '--exclude=/build/webapp/release',
  '--exclude=/libxulsword/build',
  '--exclude=/archive',
  '--exclude=/IBTSite',
  '--exclude=/profile_webapp',
  '--exclude=/.yarn/cache',
  '--exclude=/.yarn/install-state.gz',
  // Of Cpp, only the prebuilt universal libxulsword is needed.
  '--include=/Cpp/',
  '--include=/Cpp/lib.darwin/',
  '--include=/Cpp/lib.darwin/**',
  '--exclude=/Cpp/*',
  `${rootPath}/`,
  `${host}:${remoteDir}/`,
]);

// 2. Build. build/release is removed first so that only the new DMG is
// there to copy back.
remote(
  [
    `cd ${quote(remoteDir)}`,
    'rm -rf build/release',
    'source ./setenv > /dev/null',
    'if [ -f ~/xulsword-dmg.env ]; then source ~/xulsword-dmg.env; fi',
    'yarn install --immutable',
    'yarn package-mac-dmg',
  ].join(' && '),
);

// 3. Copy the DMG back.
const dmgs = execFileSync(
  'ssh',
  [host, `cd ${quote(remoteDir)}/build/release && ls *-universal.dmg`],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean);
if (dmgs.length !== 1)
  throw new Error(`Expected one universal DMG on the VM, found: ${dmgs}`);
fs.mkdirSync(releasePath, { recursive: true });
run('rsync', [
  '-a',
  '--progress',
  `${host}:${remoteDir}/build/release/${dmgs[0]}`,
  `${releasePath}/`,
]);

const dmg = path.join(releasePath, dmgs[0]);
const mb = Math.round(fs.statSync(dmg).size / 1000000);
const min = ((Date.now() - start) / 60000).toFixed(1);
console.log(`\nDone in ${min} minutes: ${dmg} (${mb} MB)`);

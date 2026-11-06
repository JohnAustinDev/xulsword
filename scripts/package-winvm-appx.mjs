#! /usr/bin/env node
/*global process */
import fs from 'fs';
import path from 'path';
import { spawnSync, execFileSync } from 'child_process';
import paths from './projectPaths.mjs';

// Build the Microsoft Store packages (.appx, which is the MSIX format) using a
// Windows VM, and copy them to build/release. electron-builder can only make
// AppX packages on Windows, while the Windows app itself is built on Linux.
//
// Usage: yarn package-winvm-appx [ia32] [x64]   (default: ia32, which runs on
// all Windows PCs)
//
// Steps:
//   1. On Linux: build the app, then electron-builder's 'dir' target for each
//      architecture (win-unpacked, win-ia32-unpacked) with that
//      architecture's libxulsword.
//   2. Copy a small project (package.json, electron-builder config, Store
//      images, winvm-appx.ps1) and the unpacked apps to the VM as a tar file.
//   3. On the VM: winvm-appx.ps1 runs electron-builder --prepackaged to make
//      each .appx.
//   4. Copy the .appx files back to build/release.
//
// The packages are not signed: the Microsoft Store signs them. To submit
// them, the appx section of package.json must hold the product identity
// values from Partner Center.
//
// Environment variables:
//   WINVM_SSH  SSH host of the VM (default: winvm). Its shell is cmd.exe.
//   WINVM_DIR  working directory on the VM (default: C:\xulsword-appx).
//              Each run replaces its 'project' folder, while its 'tools'
//              folder keeps electron-builder between runs.
// The VM needs Node.js and internet access (for electron-builder's Windows
// tools).

const host = process.env.WINVM_SSH || 'winvm';
const vmDir = process.env.WINVM_DIR || 'C:\\xulsword-appx';
const vmProject = `${vmDir}\\project`;
const { rootPath, releasePath } = paths;

const archInfo = {
  x64: { pklib: '64win', unpacked: 'win-unpacked' },
  ia32: { pklib: '32win', unpacked: 'win-ia32-unpacked' },
};
const archs = process.argv.slice(2);
if (!archs.length) archs.push('ia32');
archs.forEach((a) => {
  if (!(a in archInfo))
    throw new Error(`Unknown architecture '${a}'. Use x64 and/or ia32.`);
});

function run(cmd, args, env) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: rootPath,
    env: { ...process.env, ...env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${cmd} failed with exit code ${result.status}`);
}

// Paths on the VM given to scp must use forward slashes. scp -O (the old
// protocol) is used because the VM's sftp-server, which newer scp uses, fails.
const scpPath = (p) => p.replace(/\\/g, '/');

const start = Date.now();

// The VM must already be running.
try {
  execFileSync(
    'ssh',
    ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, 'ver'],
    { stdio: 'ignore' },
  );
} catch {
  throw new Error(
    `Cannot connect to the Windows VM with 'ssh ${host}'. Is it running?`,
  );
}

// 1. Build on Linux.
run('yarn', ['build:clean']);
run('yarn', ['build:app']);
try {
  archs.forEach((arch) => {
    run('node', ['./scripts/install-libxulsword.mjs'], {
      PKLIB: archInfo[arch].pklib,
    });
    run('yarn', [
      'electron-builder',
      'build',
      '--win',
      'dir',
      `--${arch}`,
      '--publish',
      'never',
    ]);
  });
} finally {
  run('node', ['./scripts/install-libxulsword.mjs'], { PKLIB: 'linux' });
}

// 2. Stage the project for the VM.
const pkg = JSON.parse(
  fs.readFileSync(path.join(rootPath, 'package.json'), 'utf8'),
);
const appPkg = JSON.parse(
  fs.readFileSync(path.join(rootPath, 'build', 'app', 'package.json'), 'utf8'),
);
const electronVersion = JSON.parse(
  fs.readFileSync(
    path.join(rootPath, 'node_modules', 'electron', 'package.json'),
    'utf8',
  ),
).version;
const builderVersion = JSON.parse(
  fs.readFileSync(
    path.join(rootPath, 'node_modules', 'electron-builder', 'package.json'),
    'utf8',
  ),
).version;

const stage = path.join(releasePath, 'appx-stage');
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(path.join(stage, 'res'), { recursive: true });
const { name, productName, version, description, author, license } = appPkg;
fs.writeFileSync(
  path.join(stage, 'package.json'),
  JSON.stringify(
    { name, productName, version, description, author, license },
    null,
    2,
  ),
);
fs.writeFileSync(
  path.join(stage, 'electron-builder.json'),
  JSON.stringify(
    {
      productName: pkg.build.productName,
      appId: pkg.build.appId,
      electronVersion,
      directories: { buildResources: 'res', output: 'out' },
      appx: pkg.build.appx,
    },
    null,
    2,
  ),
);
fs.cpSync(
  path.join(rootPath, 'assets', 'appx'),
  path.join(stage, 'res', 'appx'),
  {
    recursive: true,
  },
);
fs.copyFileSync(
  path.join(rootPath, 'scripts', 'winvm-appx.ps1'),
  path.join(stage, 'winvm-appx.ps1'),
);
const tarFile = path.join(releasePath, 'appx-stage.tar');
run('tar', [
  '-cf',
  tarFile,
  '-C',
  stage,
  '.',
  '-C',
  releasePath,
  ...archs.map((a) => archInfo[a].unpacked),
]);

// Recreate the project folder on the VM, then copy and unpack the tar.
run('ssh', [host, `rmdir /s /q ${vmProject} 2>nul & mkdir ${vmProject}`]);
run('scp', ['-O', tarFile, `${host}:${scpPath(vmProject)}/stage.tar`]);
fs.rmSync(tarFile);
fs.rmSync(stage, { recursive: true });

// 3. Build the .appx files on the VM.
run('ssh', [
  host,
  [
    `cd /d ${vmProject}`,
    'tar -xf stage.tar',
    'del stage.tar',
    'powershell -NoProfile -ExecutionPolicy Bypass -File winvm-appx.ps1 ' +
      `-BuilderVersion ${builderVersion} ` +
      `-Archs ${archs.map((a) => `${a}:${archInfo[a].unpacked}`).join(',')}`,
  ].join(' && '),
]);

// 4. Copy the .appx files back.
const appxs = execFileSync(
  'ssh',
  [host, `cd /d ${vmProject}\\out && dir /b *.appx`],
  { encoding: 'utf8' },
)
  .split(/\r?\n/)
  .filter(Boolean);
if (appxs.length !== archs.length)
  throw new Error(`Expected ${archs.length} .appx on the VM, found: ${appxs}`);
appxs.forEach((f) =>
  run('scp', [
    '-O',
    `${host}:${scpPath(vmProject)}/out/${f}`,
    `${releasePath}/`,
  ]),
);

const min = ((Date.now() - start) / 60000).toFixed(1);
console.log(`\nDone in ${min} minutes:`);
appxs.forEach((f) => {
  const file = path.join(releasePath, f);
  const mb = Math.round(fs.statSync(file).size / 1000000);
  console.log(`  ${file} (${mb} MB)`);
});
if (JSON.stringify(pkg.build.appx).includes('TODO'))
  console.log(
    '\nNOTE: package.json appx still has TODO identity values. These ' +
      'packages are for testing only; the Store will reject them.',
  );

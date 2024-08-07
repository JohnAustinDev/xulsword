#! /usr/bin/env node
/*global process */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Copy appropriate Node-API binary and DLLs to the Release folder.

const dirname = path.dirname(fileURLToPath(import.meta.url));

const xulsword = process.env.XULSWORD;
if (
  !xulsword ||
  !fs.existsSync(xulsword) ||
  !fs.statSync(xulsword).isDirectory()
)
  throw new Error(`Set environment variables by running: 'source ./setenv'`);

const os = process.platform == 'win32' ? process.env.XCWD : 'linux';
const machine = process.env.PKLIB || os;

const build = path.join(dirname, 'build');
if (fs.existsSync(build)) fs.rmSync(build, { recursive: true });
const release = path.join(dirname, 'build', 'Release');
fs.mkdirSync(release, { recursive: true });
console.log(`Installing ${machine} xulsword.node binary.`);

let bindir = 'linux-x64-89';
if (machine === '32win') bindir = 'win32-ia32-89';
else if (machine === '64win') bindir = 'win32-x64-89';
const binfile = path.join(dirname, 'bin', bindir, 'libxulsword.node');
console.log(`Copying Node-API binary xulsword.node to ${release}`);
if (!fs.existsSync(binfile))
  throw new Error(`Library does not exist! ${binfile}`);
const tofile = path.join(release, 'xulsword.node');
fs.copyFileSync(binfile, tofile);

// Although Linux dynamic libraries need to be installed alongside the main electron executable
// and so need to be installed by electron-builder according to the package.json build section,
// Windows dynamic libraries are installed to the libxulsword addon alongside xulsword.node.
if (machine.includes('win')) {
  const shared = path.join(xulsword, 'Cpp', `lib.${machine}`);
  if (shared && fs.existsSync(shared) && fs.statSync(shared).isDirectory()) {
    fs.readdirSync(shared).forEach((name) => {
      console.log(
        `Copying shared library ${name} to ${path.join(release, name)}`,
      );
      fs.copyFileSync(path.join(shared, name), path.join(release, name));
    });
  } else
    throw new Error(
      `Windows ${machine} libxulsword DLL has not been built:
    Run xulsword init.sh after setting WINMACHINE=${machine === '64win' ? 'x64' : 'x86'} in xulsword/setenv`,
    );
}

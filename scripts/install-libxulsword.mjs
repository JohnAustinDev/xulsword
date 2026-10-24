#! /usr/bin/env node
/*global process */
import fs from 'fs';
import path from 'path';
import paths from './projectPaths.mjs';

// Copy the appropriate Node-API binary, and for Windows and MacOS the co-
// located dynamic libraries, from the Cpp/lib directory where libxulsword-
// build.sh put them, to the libxulsword module's build/Release folder.

const xulsword = process.env.XULSWORD;
if (
  !xulsword ||
  !fs.existsSync(xulsword) ||
  !fs.statSync(xulsword).isDirectory()
)
  throw new Error(`Set environment variables by running: 'source ./setenv'`);

let os = 'linux';
if (process.platform == 'win32') os = process.env.XCWD;
else if (process.platform == 'darwin') os = 'darwin';
const machine = process.env.PKLIB || os;

const isWindows = machine === '32win' || machine === '64win';
const isMac = machine === 'darwin';

const libdir = path.join(
  paths.rootPath,
  'Cpp',
  machine === 'linux' ? 'lib' : `lib.${machine}`,
);
const addon = 'libxulsword.node';
const binfile = path.join(libdir, addon);
if (!fs.existsSync(binfile)) {
  let setting = '';
  if (isMac) setting = ' after setting MACMACHINE=universal in xulsword/setenv';
  else if (isWindows)
    setting = ` after setting WINMACHINE=${machine === '64win' ? 'x64' : 'x86'} in xulsword/setenv`;
  throw new Error(
    `The ${machine} libxulsword addon has not been built: ${binfile}
    Run xulsword/Cpp/docker-build.sh${setting}`,
  );
}

const build = path.join(paths.rootPath, 'libxulsword', 'build');
if (fs.existsSync(build)) fs.rmSync(build, { recursive: true });
const release = path.join(build, 'Release');
fs.mkdirSync(release, { recursive: true });
console.log(`Installing ${machine} xulsword.node binary.`);

console.log(`Copying Node-API binary ${binfile} to ${release}/xulsword.node`);
fs.copyFileSync(binfile, path.join(release, 'xulsword.node'));

// Although Linux dynamic libraries need to be installed alongside the main electron executable
// and so need to be installed by electron-builder according to the package.json build section,
// Windows and MacOS dynamic libraries are installed to the libxulsword addon alongside xulsword.node.
if (isWindows || isMac) {
  fs.readdirSync(libdir)
    .filter((name) => name !== addon)
    .forEach((name) => {
      console.log(
        `Copying shared library ${name} to ${path.join(release, name)}`,
      );
      fs.copyFileSync(path.join(libdir, name), path.join(release, name));
    });
}

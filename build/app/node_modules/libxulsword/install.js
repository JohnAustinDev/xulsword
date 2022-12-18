#! /usr/bin/env node
const fs = require('fs');
const path = require('path');

// Copy PKLIB Node-API binary and MS-Windows dependent libraries to the Release folder.

const xulsword = process.env.XULSWORD;
if (!xulsword || !fs.existsSync(xulsword) || !fs.statSync(xulsword).isDirectory())
  throw new Error(`Set environment variables by running: 'source ./setenv'`);

const os = process.platform === 'win32' ? '32win' : 'linux';
const machine = process.env.PKLIB || 'linux';

const build = path.join(__dirname, 'build');
console.log(`Installing ${machine} xulsword.node binary to ${build}`);
if (fs.existsSync(build)) fs.rmSync(build, { recursive: true });

const release = path.join(__dirname, 'build', 'Release');
fs.mkdirSync(release, { recursive: true });

const nodeapi = machine.includes('win') ? 'libxulsword.node' : 'xulsword.node';
const binfile = path.join(__dirname, 'lib', machine, nodeapi);
console.log(`Copying Node-API binary xulsword.node`);
if (!fs.existsSync(binfile)) throw new Error(`Library does not exist! ${binfile}`);
const tofile = path.join(release, 'xulsword.node');
fs.copyFileSync(binfile, tofile);

// Linux .so files need to be alongside the electron executable and so need to be installed
// by the package.json build section. But .dll files come in two flavors and should be
// installed alongside the libxulsword addon and need to be handled here.
if (machine.includes('win')) {
  shared = path.join(xulsword, 'Cpp', `install.${machine}`, 'dll');
  if (shared && fs.existsSync(shared) && fs.statSync(shared).isDirectory()) {
    fs.readdirSync(shared).forEach((name) => {
      console.log(`Copying shared library ${name}`);
      fs.copyFileSync(path.join(shared, name), path.join(release, name));
    });
  } else throw new Error(
    `Windows ${machine} libxulsword DLL has not been built:
    Run xulsword init.sh after setting WINMACHINE=${machine === '64win' ? 'x64' : 'x86'} in xulsword/setenv`
  );
}

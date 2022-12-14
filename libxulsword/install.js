#! /usr/bin/env node
const fs = require('fs');
const path = require('path');

// Copy PKLIB Node-API binary and its dependent libraries to the Release folder.

const xulsword = process.env.XULSWORD;
if (!xulsword || !fs.existsSync(xulsword) || !fs.statSync(xulsword).isDirectory())
  throw new Error(`Set environment variables by running: 'source ./setenv'`);

const machine = process.env.PKLIB || 'linux';

const build = path.join(__dirname, 'build');
console.log(`Installing ${machine} xulsword.node binary to ${build}`);
if (fs.existsSync(build)) fs.rmSync(build, { recursive: true });

const release = path.join(__dirname, 'build', 'Release');
fs.mkdirSync(release, { recursive: true });

const binary = machine.includes('win') ? 'libxulsword.node' : 'xulsword.node';
const binfile = path.join(__dirname, 'lib', machine, binary);
console.log(`Copying Node-API binary xulsword.node`);
if (!fs.existsSync(binfile)) throw new Error(`Library does not exist!`);
const tofile = path.join(release, 'xulsword.node');
fs.copyFileSync(binfile, tofile);

let shared;
if (machine === 'linux') shared = path.join(xulsword, 'Cpp', 'install', 'so');
else if (machine.includes('win')) shared = path.join(xulsword, 'Cpp', `install.${machine}`, 'dll');
if (shared && fs.existsSync(shared) && fs.statSync(shared).isDirectory()) {
  fs.readdirSync(shared).forEach((name) => {
    console.log(`Copying shared library ${name}`);
    fs.copyFileSync(path.join(shared, name), path.join(release, name));
  });
}

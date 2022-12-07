#! /usr/bin/env node
const { copyFileSync } = require('fs');
const path = require('path');
const { exec } = require('child_process');
const nodeGyp = require("node-gyp")();

console.log(`Cross-compiling with ${process.env.CXX_target}`);

process.chdir(__dirname);

if (!process.env.TOOLCHAIN_PREFIX)
  throw new Error(`Environment has not be set. Run 'source ./setenv'`);
/*
if (process.env.XCOMP && (
    !process.env.TOOLCHAIN_PREFIX.endsWith(process.env.XCOMP) ||
    process.env.ADDRESS_MODEL !== process.env.XADS
)) {
  throw new Error(`${process.env.CXX_target} does not match environment vars XCOMP and/or XADS`);
}
*/
console.log(`TOOLCHAIN: ${process.env.TOOLCHAIN_PREFIX}`);
console.log(`ADDRESS_MODEL: ${process.env.ADDRESS_MODEL}`);
console.log(`GCCSTD: ${process.env.GCCSTD}`);

nodeGyp.parseArgv([]);

new Promise((resolve) => {
  nodeGyp.commands.clean([], () => resolve());
})
.then(() => {
  return new Promise((resolve) => {
    nodeGyp.commands.configure([], () => resolve());
  });
})
.then(() => {
  return new Promise((resolve, reject) => {
    // Fix an apparent i686-w64-mingw32-ln bug where circular library linking
    // fails to link anything, but the normal --libs flag works fine.
    exec('patch -s -p0 < build.patch', (error, stdout, stderr) => {
      console.log(`${stderr}\n${stdout}`);
      if (error) reject(error);
      else resolve(stdout);
    });
  });
})
.then(() => {
  return new Promise((resolve) => {
    nodeGyp.commands.build([], () => resolve());
  });
})
.then(() => {
  // The cross compiled lib always goes to Release. So if this is
  // a host build, copy the correct lib over.
  if (!process.env.XCOMP) {
    const destdir = path.join(__dirname, 'build', 'Release');
    const src = path.join(destdir, `xulswordHost.node`)
    // copyFileSync(src, path.join(destdir, 'xulsword.node'));
  }
})
.catch((er) => console.log(er));

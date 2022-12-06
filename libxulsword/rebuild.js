#! /usr/bin/env node
const { exec } = require('child_process');
const nodeGyp = require("node-gyp")();

// Check the environment variables correspond to the current build.
console.log(`ARGUMENTS: ${process.argv}`);
console.log(`TOOLCHAIN: ${process.env.TOOLCHAIN_PREFIX}`);
console.log(`ADDRESS_MODEL: ${process.env.ADDRESS_MODEL}`);
console.log(`GCCSTD: ${process.env.GCCSTD}`);

nodeGyp.parseArgv([]);

console.log(`Cross-compiling to windows with ${process.env.CXX_target }`);

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
.catch((er) => console.log(er));

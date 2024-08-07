import rimraf from 'rimraf';
import webpackPaths from './projectPaths.mjs';
import process from 'process';

const args = process.argv.slice(2);
const commandMap = {
  dist: webpackPaths.appDistPath,
  release: webpackPaths.releasePath,
};

args.forEach((x) => {
  const pathToRemove = commandMap[x];
  if (pathToRemove !== undefined) {
    rimraf.sync(pathToRemove);
  }
});

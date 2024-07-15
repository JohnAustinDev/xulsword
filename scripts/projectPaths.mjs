import path from 'path';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const rootPath = path.join(dirname, '..');

const dllPath = path.join(dirname, '..', '.dll');

const srcPath = path.join(rootPath, 'src');
const srcMainPath = path.join(srcPath, 'main');
const srcRendererPath = path.join(srcPath, 'renderer');
const srcNodeModulesPath = path.join(srcPath, 'node_modules');

const buildPath = path.join(rootPath, 'build');
const appPath = path.join(buildPath, 'app');
const appDistPath = path.join(appPath, 'dist');
const appPackagePath = path.join(appPath, 'package.json');
const appNodeModulesPath = path.join(appPath, 'node_modules');

const webappPath = path.join(buildPath, 'webapp');
const webappDistPath = path.join(webappPath, 'dist');

const releasePath = path.join(buildPath, 'release');

export default {
  rootPath,
  dllPath,
  srcPath,
  srcMainPath,
  srcRendererPath,
  buildPath,
  webappPath,
  webappDistPath,
  appPath,
  appPackagePath,
  appNodeModulesPath,
  srcNodeModulesPath,
  appDistPath,
  releasePath,
};

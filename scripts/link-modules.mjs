import fs from 'fs';
import appPaths from './projectPaths.mjs';

const { appNodeModulesPath, srcNodeModulesPath } = appPaths;

if (!fs.existsSync(srcNodeModulesPath) && fs.existsSync(appNodeModulesPath)) {
  fs.symlinkSync('../build/app/node_modules', srcNodeModulesPath, 'junction');
}

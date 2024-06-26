import fs from 'fs';
import {
  appNodeModulesPath,
  srcNodeModulesPath,
} from '../configs/webpack.paths.js';

if (!fs.existsSync(srcNodeModulesPath) && fs.existsSync(appNodeModulesPath)) {
  fs.symlinkSync('../build/app/node_modules', srcNodeModulesPath, 'junction');
}

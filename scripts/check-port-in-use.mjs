/*global process */
import chalk from 'chalk';
import detectPort from 'detect-port';
import { devServerPort } from '../webpack.config.mjs';

const port = String(devServerPort);

detectPort(port, (err, availablePort) => {
  if (port !== String(availablePort)) {
    throw new Error(
      chalk.whiteBright.bgRed.bold(
        `Port "${port}" on "localhost" is already in use.`,
      ),
    );
  } else {
    process.exit(0);
  }
});

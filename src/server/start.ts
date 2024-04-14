import ChildProcess from 'child_process';
import fs from 'fs';

// Set environment variables then spawn a server.
const root = `${__dirname}/../..`;
const wsc = fs.readFileSync(
  `${root}/webserver_config.json`,
  { encoding: 'utf-8' }
);
if (wsc) {
  const c = JSON.parse(wsc);
  if ('env' in c && typeof c.env === 'object') {
    Object.entries(c.env).forEach((entry) => {
      process.env[entry[0]] = entry[1] as string;
    });
  }
}

const node = ChildProcess.spawn(
  'node',
  [`--require=${root}/.erb/scripts/babel-register`, `${__dirname}/server.ts`],
  { cwd: root }
);

node.stdout.on('data', (data) => {
  console.log(`${data}`);
});

node.stderr.on('data', (data) => {
  console.error(`${data}`);
});

node.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});

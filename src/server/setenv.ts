import fs from 'fs';

// Load environment variables from a file.
// NOTE: LD_LIBRARY_PATH must be set in the process which starts
// node, therefore setting it here would be too late.
export default function Setenv(path:string) {
  if (fs.existsSync(path)) {
    const wsc = fs.readFileSync(path, { encoding: 'utf-8' });
    if (wsc) {
      const c = JSON.parse(wsc);
      if (typeof c === 'object') {
        Object.entries(c).forEach((entry) => {
          process.env[entry[0]] = entry[1] as string;
        });
      }
    } else {
      throw new Error(`Bad environment file: ${path}`);
    }
  } else {
    throw new Error(`Environment file does not exist: ${path}`);
  }
};
import fs from 'fs';
import log from 'electron-log';
import { JSON_stringify } from '../common.ts';
import libxulsword from '../../node_modules/libxulsword/libxulsword.mjs';

import type { LogLevel } from 'electron-log';

export type MessagesToIndexWorker =
  | {
      command: 'start';
      directories: string[];
      module: string;
    }
  | {
      command: 'log';
      logfile: string;
      loglevel: LogLevel;
    };

export type MessagesFromIndexWorker =
  | {
      msg: 'finished' | 'failed';
    }
  | {
      msg: 'working';
      percent: number;
    };

// Libxulsword requires both these callbacks to be defined.
global.ToUpperCase = (aString) => {
  if (aString) {
    return aString.toUpperCase();
  }
  return '';
};
global.ReportSearchIndexerProgress = (percent) => {
  send({ msg: 'working', percent });
};

function send(msg: MessagesFromIndexWorker) {
  log.silly(`Index Worker sending to Xulsword ${JSON_stringify(msg)}`);
  if (typeof process?.send === 'function') {
    process.send(msg);
  }
}

process.on('message', (msg: MessagesToIndexWorker) => {
  log.silly(`Index Worker received from Xulsword ${JSON_stringify(msg)}`);
  const { command } = msg;
  switch (command) {
    case 'log': {
      const { logfile, loglevel } = msg;
      log.transports.console.level = loglevel;
      log.transports.file.level = loglevel;
      log.transports.file.resolvePath = () => logfile;
      return; // return doesn't disconnect!
    }
    case 'start': {
      const { directories, module } = msg;
      let success = false;
      if (Array.isArray(directories)) {
        const mf = directories.filter((p) => fs.existsSync(p));
        if (mf.length) {
          success = libxulsword.GetXulsword(mf.join(', '));
        }
      }
      if (success) {
        const mods = libxulsword
          .GetModuleList()
          .split('<nx>')
          .map((s: string) => s.split(';')[0]);
        if (mods.includes(module)) {
          if (libxulsword.LuceneEnabled(module)) {
            success = libxulsword.SearchIndexDelete(module);
          }
          if (success) success = libxulsword.SearchIndexBuild(module);
        }
      }
      if (success) send({ msg: 'finished' });
      else send({ msg: 'failed' });
      break;
    }
    default:
      send({ msg: 'failed' });
  }

  log.debug(`Index Worker: disconnect after ${JSON_stringify(msg)}`);
  process.disconnect();
});

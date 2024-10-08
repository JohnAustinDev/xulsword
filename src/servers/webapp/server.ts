import { Server } from 'socket.io';
import i18n from 'i18next';
import helmet from 'helmet';
import session from 'express-session';
import { RateLimiterMemory } from 'rate-limiter-flexible';
// import toobusy from 'toobusy-js';
import memorystore from 'memorystore';
import log from 'electron-log';
import i18nBackendMain from 'i18next-fs-backend';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import {
  JSON_parse,
  JSON_stringify,
  isInvalidWebAppData,
} from '../../common.ts';
import Cache from '../../cache.ts';
import C from '../../constant.ts';
import { GI } from './G.ts';
import handleGlobal from '../handleG.ts';
import { getSystemFonts } from '../common.ts';
import Dirs from '../components/dirs.ts';
import LibSword from '../components/libsword.ts';

import type { Socket } from 'socket.io';
import type { LogLevel } from 'electron-log';
import type { GCallType } from '../../type.ts';

// A NodeJS server that provides responses for xulsword web apps.

Dirs.init();

const isInvalidWebAppDataLogged = (data: unknown, depth = 0) => {
  return isInvalidWebAppData(data, depth, log);
};

const logfile = Dirs.LogDir.append(`access.log`);
log.transports.console.level = C.LogLevel;
log.transports.file.level = C.LogLevel;
log.transports.file.sync = false;
log.transports.file.maxSize = Number(process.env.WEBAPP_MAX_LOG_SIZE) || 5000000;
log.transports.file.archiveLog = (file) => {
  const filename = file.toString();
  const info = path.parse(filename);
  let num = 0;
  const files = fs.readdirSync(info.dir, { encoding: 'utf-8' });
  const re = new RegExp(`${info.name}${info.ext}\\.(\\d+)$`);
  files.forEach((f) => {
    const m = f.match(re);
    if (m && Number(m[1]) > num) num = Number(m[1]);
  });
  num += 1;
  try {
    fs.renameSync(filename, path.join(info.dir, info.name + info.ext + `.${num}`));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Error rotating log: ', e);
  }
}
log.transports.file.resolvePath = () => logfile.path;

LibSword.init();

const modlist = LibSword.getModuleList();
const mods = modlist === C.NOMODULES ? [] : modlist.split('<nx>');
log.transports.console.level = 'info';
log.transports.file.level = 'info';
log.info(
  `SWORD modules: ${mods.length}, LogLevel: ${C.LogLevel}, Logfile: ${logfile.path}, Port: ${process.env.WEBAPP_PORT}`,
);
log.transports.console.level = C.LogLevel;
log.transports.file.level = C.LogLevel;

const AvailableLanguages = [
  ...new Set(
    C.Locales.map((l) => {
      return l[0];
    })
      .map((l) => {
        return [l, l.replace(/-.*$/, '')];
      })
      .flat(),
  ),
];

i18nInit('en').catch((er) => {
  log.error(`Server i18nInit('en') error: ${er}`);
});

const sslkey = process.env.SERVER_KEY_PEM;
const sslcrt = process.env.SERVER_CRT_PEM;
let server;
if (sslkey && sslcrt) {
  server = https.createServer({
    key: fs.readFileSync(sslkey),
    cert: fs.readFileSync(sslcrt),
    enableTrace: false, // set to true to debug connection
  });
} else {
  server = http.createServer();
}

const io = new Server(server, {
  serveClient: false,
  cors: {
    origin: process.env.WEBAPP_CORS_ORIGIN,
    methods: ['GET'],
  },
});

const MemoryStore = memorystore(session);
io.engine.use(helmet());
io.engine.use(
  session({
    secret: 'fk95DSfgj7fUkldf',
    name: 'ibtxulsword',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true, sameSite: true },
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
      max: 1000000,
    }),
  }),
);

const rateLimiter = new RateLimiterMemory(C.Server.ipLimit);
// toobusy.maxLag(300); // in ms: default is 70

io.on('connection', (socket) => {

  // Check Node.JS RAM usage and clear LibSword cache as needed.
  let ramMB = Math.ceil(process.memoryUsage().rss / 1000000);
  const maxRamMB = (Number(process.env.WEBAPP_MAX_CACHE_RAMMB) || 250);
  if (ramMB > maxRamMB) {
    Cache.clear('G', 'LibSword');
    const ramMB2 = Math.ceil(process.memoryUsage().rss / 1000000);
    log.info(`${socket.handshake.address} › Cleared G.LibSword cache (limit ${maxRamMB}, was ${ramMB}, is ${ramMB2})`);
    ramMB = ramMB2;
  }
  log.info(`${socket.handshake.address} › Connected (${ramMB} MB RAM usage).`);

  socket.on(
    'error-report',
    async (args: any[], _callback: (r: any) => void) => {
      log.silly(`on error-report: ${JSON_stringify(args)}`);
      const limited = await isLimited(socket);
      if (!limited) {
        const invalid = invalidArgs(args);
        if (!invalid && args.length === 1) {
          const [message] = args;
          if (typeof message === 'string') {
            log.error(
              `${socket.handshake.address} › client error-report: ${message}`,
            );
            return;
          }
        }
        log.error(
          `${socket.handshake.address} › Client 'error-report' made with improper arguments: ${JSON_stringify(args)}. (${invalid})`,
        );
      } else {
        // eslint-disable-next-line no-console
        console.log(`${socket.handshake.address} › rate limited! dropping error-report.`);
      }
    },
  );

  socket.on('log', async (args: any[], _callback: (r: any) => void) => {
    log.silly(`${socket.handshake.address} › on log: ${JSON_stringify(args)}`);
    const limited = await isLimited(socket);
    if (!limited) {
      const invalid = invalidArgs(args);
      if (!invalid && args.length === 3) {
        const [type, windowID, json] = args as [string, string, string];
        const logargs =
          json.length > C.Server.maxLogJson
            ? [`log too long. [${json.length}]`]
            : JSON_parse(json);
        if (
          type in log &&
          ['string', 'number'].includes(typeof windowID) &&
          Array.isArray(logargs)
        ) {
          try {
            log[type as LogLevel](
              windowID,
              `${socket.handshake.address} › `,
              ...(logargs as unknown[]),
            );
          } catch (er: any) {
            log.error(
              `${socket.handshake.address} › in log of ${JSON_stringify(args)}: ${er.toString()}`,
            );
          }
          return;
        }
      }
      log.error(
        `${socket.handshake.address} › 'log' call made with improper arguments. (${invalid})`,
      );
    } else {
      log.warn(`${socket.handshake.address} › rate limited! dropping log request.`);
    }
  });

  socket.on('global', async (args: any[], callback: (r: any) => void) => {
    log.silly(`on global: ${JSON_stringify(args)}`);
    const limited = await isLimited(socket, true);
    if (!limited) {
      const invalid = invalidArgs(args);
      if (!invalid && args.length === 1 && typeof callback === 'function') {
        const acall = args.shift() as GCallType;
        let arginfo = `${acall[2]?.length} args`;
        if (acall[0].startsWith('callBatch')) {
          arginfo = `${(acall[2] as any)[0].length} calls`;
        }
        log.info(
          `${socket.handshake.address} › Global [${acall[0]}, ${acall[1]}, [${arginfo}]]`,
        );
        if (Array.isArray(acall) && acall.length && acall.length <= 3) {
          let r;
          try {
            r = handleGlobal(GI, -1, acall, false);
          } catch (er: any) {
            log.error(
              `${socket.handshake.address} › in handleGlobal(GIm -1, ${JSON_stringify(acall)}, false): ${er}`,
            );
          }
          if (r instanceof Promise) {
            r.then((result) => {
              const invalid = isInvalidWebAppDataLogged(result);
              if (!invalid) callback(result);
              else
                log.error(
                  `${socket.handshake.address} › invalid promise request: ${invalid}`,
                );
            }).catch((er) => {
              log.error(
                `${socket.handshake.address} › in isInvalidWebAppDataLogged(): ${er}`,
              );
            });
          } else {
            const invalid = isInvalidWebAppDataLogged(r);
            if (!invalid) callback(r);
            else
              log.error(
                `${socket.handshake.address} › invalid sync request: ${invalid}`,
              );
          }
          return;
        }
      }
      log.error(
        `${socket.handshake.address} › Ignoring 'global' call made with improper arguments. (${invalid})`,
      );
    } else if (typeof callback === 'function') {
      const msg = Build.isDevelopment ? JSON_stringify(args) : args.length;
      log.warn(`${socket.handshake.address} › rate limiting callback. [${msg}]`);
      callback({ limitedDoWait: C.Server.limitedMustWait });
    } else {
      const msg = Build.isDevelopment ? JSON_stringify(args) : args.length;
      log.warn(`${socket.handshake.address} › rate limiting. [${msg}]`);
    }
  });
});

server.listen(Number(process.env.WEBAPP_PORT));

// Return a reason message if arguments are invalid or null if they are valid.
function invalidArgs<T>(args: T[]): string | null {
  return Array.isArray(args)
    ? isInvalidWebAppDataLogged(args)
    : `Arguments must be an array. (was ${typeof args})`;
}

async function isLimited(
  socket: Socket,
  _checkbusy = false,
): Promise<boolean> {
  // Check-busy is disabled for now...
  /*
  if (checkbusy && toobusy()) {
    log.warn(`${socket.handshake.address} › server too busy.`);
    return true;
  }
  */
  try {
    await rateLimiter.consume(socket.handshake.address);
    return false;
  } catch (er) {
    return true;
  }
}

async function i18nInit(lng: string) {
  await i18n
    .use(i18nBackendMain)
    .init({
      lng,
      fallbackLng: C.FallbackLanguage[lng] || ['en'],
      supportedLngs: AvailableLanguages,
      preload: AvailableLanguages,

      ns: ['xulsword', 'branding', 'config', 'books', 'numbers'],
      defaultNS: 'xulsword',

      debug: false,

      backend: {
        // path where resources get loaded from
        loadPath: `${Dirs.path.xsAsset}/locales/{{lng}}/{{ns}}.json`,
        // path to post missing resources
        addPath: `${Dirs.path.xsAsset}/locales/{{lng}}/{{ns}}.missing.json`,
        // jsonIndent to use when storing json files
        jsonIndent: 2,
      },
      saveMissing: Build.isDevelopment,
      saveMissingTo: 'current',

      react: {
        useSuspense: false,
      },

      interpolation: {
        escapeValue: false, // not needed for react as it escapes by default
      },

      keySeparator: false,
    })
    .catch((e) => {
      log.error(`ERROR: in i18n init(): ${e}`);
    });
}

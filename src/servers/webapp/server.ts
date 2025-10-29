import { Server } from 'socket.io';
import i18n from 'i18next';
import helmet from 'helmet';
import session from 'express-session';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import toobusy from 'toobusy-js';
import memorystore from 'memorystore';
import log from 'electron-log';
import i18nBackendMain from 'i18next-fs-backend';
import https from 'https';
import http from 'http';
import fs from 'fs';
import { GI } from './G.ts';
import {
  JSON_parse,
  JSON_stringify,
  callLog,
  isInvalidWebAppData,
} from '../../common.ts';
import Subscription from '../../subscription.ts';
import Cache from '../../cache.ts';
import C from '../../constant.ts';
import handleGlobal from '../handleG.ts';
import { resetMain } from '../common.ts';
import Dirs from '../components/dirs.ts';
import LibSword from '../components/libsword.ts';

import type { Socket } from 'socket.io';
import type { LogLevel } from 'electron-log';
import type { GCallType, ServerWait } from '../../type.ts';

// A NodeJS server that provides responses for xulsword web apps.

Dirs.init();

const isInvalidWebAppDataLogged = (data: unknown, depth = 0) => {
  return isInvalidWebAppData(data, depth, log);
};

const logfile = Dirs.LogDir.append(`xulsword.log`);
log.transports.console.level = C.LogLevel;
log.transports.file.level = C.LogLevel;
log.transports.file.sync = false;
log.transports.file.maxSize = 0;
log.transports.file.resolvePathFn = () => logfile.path;

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

// Some modules in the xsModsUser or xsModsCommon repositories may be
// made unavailable to the web app.
const readWebAppSkipModules = () => {
  const nowebapp = Dirs.xsModsUser.append('nowebapp');
  const skipModules = (nowebapp.exists() && nowebapp.readFile()) || '';
  return (
    (skipModules.match(/^[A-Za-z0-9_]+(,\s*[A-Za-z0-9_]+)*\s*$/) &&
      skipModules) ||
    ''
  );
};
global.WebAppSkipModules = readWebAppSkipModules();
Subscription.subscribe.resetMain(() => {
  global.WebAppSkipModules = readWebAppSkipModules();
  LibSword.quit();
  Cache.clear();
  LibSword.init();
});
setInterval(() => {
  const reset = Dirs.xsModsUser.append('reset');
  if (reset.exists()) {
    reset.remove();
    if (!reset.exists()) {
      log.warn(`Resetting server after reset file detection.`);
      resetMain();
    }
  }
}, 5000);

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

let origin: string | string[] = process.env.WEBAPP_CORS_ORIGIN || '';
if (typeof origin === 'string' && origin.includes(','))
  origin = origin.split(/\s*,\s*/);
const io = new Server(server, {
  serveClient: false,
  cors: {
    origin,
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
toobusy.maxLag(C.Server.tooBusyMaxLag);

io.on('connection', (socket) => {
  // Check Node.JS RAM usage and clear LibSword cache as needed.
  let ramMB = Math.ceil(process.memoryUsage().rss / 1000000);
  const maxRamMB = Number(process.env.WEBAPP_MAX_CACHE_RAMMB) || 250;
  if (ramMB > maxRamMB) {
    Cache.clear('G', 'LibSword');
    const ramMB2 = Math.ceil(process.memoryUsage().rss / 1000000);
    log.info(
      `${socket.handshake.address} › Cleared G.LibSword cache (limit ${maxRamMB}, was ${ramMB}, is ${ramMB2})`,
    );
    ramMB = ramMB2;
  }
  log.info(`${socket.handshake.address} › Connected (${ramMB} MB RAM usage).`);

  socket.on('log', async (args: any[], _callback: (r: any) => void) => {
    const clog = argLog(args);
    log.silly(`${socket.handshake.address} › on log: ${clog}`);
    const invalid = invalidArgs(args);
    if (!invalid && args.length === 3) {
      const [type, client, json] = args as [string, string, string, string];
      const logargs =
        json.length > C.Server.maxLogJson
          ? [`log too long. [${json.length}]`]
          : JSON_parse(json);
      if (type in log && Array.isArray(logargs)) {
        // Don't let development log messages rate limit the dev server!
        const limited = Build.isDevelopment ? '' : await isLimited(socket);
        if (limited) logargs.push(`(${limited})`);
        try {
          log[type as LogLevel](
            client,
            `${socket.handshake.address} › `,
            ...(logargs as unknown[]),
          );
        } catch (er: any) {
          log.error(
            `${socket.handshake.address} › While logging ${clog}: ${er.toString()}`,
          );
        }
        return;
      }
    }
    log.error(
      `${socket.handshake.address} › A 'log' call was made with improper arguments. (${invalid})`,
    );
  });

  socket.on('global', async (args: any[], callback: (r: any) => void) => {
    let clog = argLog(args);
    log.silly(`on global: ${clog}`);
    const limited = await isLimited(socket);
    if (!limited) {
      const invalid = invalidArgs(args);
      if (!invalid && args.length === 1 && typeof callback === 'function') {
        const acall = args.shift() as GCallType;
        clog = callLog(acall);
        log.info(`${socket.handshake.address} › Global ${clog}`);
        if (Array.isArray(acall) && acall.length && acall.length <= 3) {
          const r = handleGlobal(GI, -1, acall, false);
          if (r instanceof Promise) {
            r.then((result) => {
              const invalid = isInvalidWebAppDataLogged(result);
              if (!invalid) {
                callback(result);
                log.silly(`FINISHED async on global.`);
              } else
                log.error(
                  `${socket.handshake.address} › Invalid promise result ${clog}: ${invalid}`,
                );
            }).catch((er) => {
              log.error(
                `${socket.handshake.address} › Result promise rejected ${clog}: ${er}`,
              );
            });
          } else {
            const invalid = isInvalidWebAppDataLogged(r);
            if (!invalid) {
              callback(r);
              log.silly(`FINISHED sync on global.`);
            } else
              log.error(
                `${socket.handshake.address} › Invalid sync result ${clog}: ${invalid}`,
              );
          }
          return;
        }
      }
      log.error(
        `${socket.handshake.address} › Ignoring 'global' call ${clog} made with improper arguments: ${invalid}`,
      );
    } else if (typeof callback === 'function') {
      log.warn(
        `${socket.handshake.address} › Requesting wait (${limited}): ${clog}`,
      );
      callback({ pleaseWait: limited } as ServerWait);
    } else {
      log.warn(
        `${socket.handshake.address} › Ignoring 'global' with improper arguments (${limited}): ${clog}`,
      );
    }
  });

  socket.on('error', (er) => {
    log.error(
      `${socket.handshake.address} › Socket EventEmitter error: ${er.message}`,
    );
  });
});

server.listen(Number(process.env.WEBAPP_PORT));

// Return a reason message if arguments are invalid or null if they are valid.
function invalidArgs<T>(args: T[]): string | null {
  return Array.isArray(args)
    ? isInvalidWebAppDataLogged(args)
    : `Arguments must be an array. (was ${typeof args})`;
}

function argLog(args: any): string {
  let msg = '';
  if (C.LogLevel === 'silly') msg = JSON_stringify(args);
  else {
    const s = typeof args.toString === 'function' ? args.toString() : 'unknown';
    msg = s.substring(0, 128) + (s.length > 128 ? '...' : '');
  }
  return msg;
}

async function isLimited(socket: Socket): Promise<ServerWait['pleaseWait']> {
  // return false; // For testing only!!
  try {
    await rateLimiter.consume(socket.handshake.address);
  } catch (er) {
    return 'RATE LIMITED';
  }
  if (typeof toobusy !== 'undefined' && toobusy()) {
    return 'TOO BUSY';
  }
  return '';
}

async function i18nInit(lng: string) {
  await i18n
    .use(i18nBackendMain)
    .init({
      lng,
      fallbackLng: C.FallbackLanguage[lng] || ['en'],
      supportedLngs: AvailableLanguages,
      preload: AvailableLanguages,

      ns: [
        'xulsword',
        'widgets',
        'bibleBrowser',
        'branding',
        'config',
        'books',
        'numbers',
      ],
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

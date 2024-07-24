import { Server } from 'socket.io';
import i18n from 'i18next';
import helmet from 'helmet';
import session from 'express-session';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import toobusy from 'toobusy-js';
import memorystore from 'memorystore';
import log from 'electron-log';
import i18nBackendMain from 'i18next-fs-backend';
import http from 'http';
import {
  JSON_parse,
  JSON_stringify,
  isInvalidWebAppData,
} from '../../common.ts';
import C from '../../constant.ts';
import { GI } from './G.ts';
import handleGlobal from '../handleGlobal.ts';
import Dirs from '../components/dirs.ts';
import LibSword from '../components/libsword.ts';

import type { Socket } from 'socket.io';
import type { LogLevel } from 'electron-log';
import type { GCallType } from '../../type.ts';

Dirs.init();

const isInvalidWebAppDataLogged = (data: unknown, depth = 0) => {
  return isInvalidWebAppData(data, depth, log);
};

const logfile = Dirs.LogDir.append(`server.${Date.now()}.log`);
log.transports.console.level = C.LogLevel;
log.transports.file.level = 'info';
log.transports.file.resolvePath = () => logfile.path;

LibSword.init();

log.info(
  `Loaded ${LibSword.getModuleList().split('<nx>').length} SWORD modules.`,
);
log.info(
  `LogLevel: ${C.LogLevel}, Logfile: ${logfile.path}, Port: ${process.env.WEBAPP_PORT}`,
);

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
  log.error(er);
});

// Do this in the background...
// G.getSystemFonts();

const server = http.createServer();

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
      checkPeriod: 86400000, // prune expires every 24h
      max: 20000000,
    }),
  }),
);

const rateLimiter = new RateLimiterMemory(C.Server.ipLimit);
toobusy.maxLag(300); // in ms: default is 70

io.on('connection', (socket) => {
  socket.on(
    'error-report',
    async (args: any[], _callback: (r: any) => void) => {
      const limited = await isLimited(socket, args);
      if (!limited) {
        const invalid = invalidArgs(args);
        if (!invalid && args.length === 1) {
          const [message] = args;
          if (typeof message === 'string') {
            log.error(`${socket.handshake.address} › error-report: ${message}`);
            return;
          }
        }
        log.error(
          `${socket.handshake.address} › Ignoring 'error-report' call made with improper arguments. (${invalid})`,
        );
      } else {
        // ignore
      }
    },
  );

  socket.on('log', async (args: any[], _callback: (r: any) => void) => {
    const limited = await isLimited(socket, args);
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
            log.error(`${socket.handshake.address} › ${er.toString()}`);
          }
          return;
        }
      }
      log.error(
        `${socket.handshake.address} › Ignoring 'log' call made with improper arguments. (${invalid})`,
      );
    } else {
      // ignore
    }
  });

  socket.on('global', async (args: any[], callback: (r: any) => void) => {
    const limited = await isLimited(socket, args, true);
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
            log.error(`${socket.handshake.address} › ${er}`);
          }
          if (r instanceof Promise) {
            r.then((result) => {
              const invalid = isInvalidWebAppDataLogged(result);
              if (!invalid) callback(result);
              else log.error(`${socket.handshake.address} › ${invalid}`);
            }).catch((er) => {
              log.error(`${socket.handshake.address} › ${er}`);
            });
          } else {
            const invalid = isInvalidWebAppDataLogged(r);
            if (!invalid) callback(r);
            else log.error(`${socket.handshake.address} › ${invalid}`);
          }
          return;
        }
      }
      log.error(
        `${socket.handshake.address} › Ignoring 'global' call made with improper arguments. (${invalid})`,
      );
    } else if (typeof callback === 'function') {
      callback({ limitedDoWait: C.Server.limitedMustWait });
    }
  });
});

io.listen(Number(process.env.WEBAPP_PORT));

// Return a reason message if arguments are invalid or null if they are valid.
function invalidArgs<T>(args: T[]): string | null {
  return Array.isArray(args)
    ? isInvalidWebAppDataLogged(args)
    : `Arguments must be an array. (was ${typeof args})`;
}

async function isLimited(
  socket: Socket,
  args: any[],
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
    const msg = Build.isDevelopment ? JSON_stringify(args) : args.length;
    log.warn(`${socket.handshake.address} › rate limiting. [${msg}]`);
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
      log.error(`ERROR: ${e}`);
    });
}

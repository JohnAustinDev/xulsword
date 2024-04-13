import { Server } from 'socket.io';
import log, { LogLevel } from 'electron-log';
import C from '../constant.ts';
import G from '../main/mgServer.ts';
import handleGlobal from '../main/handleGlobal.ts';
import { GType } from '../type.ts';
import { JSON_parse } from '../common.ts';

const i18nBackendMain = require('i18next-fs-backend');

G.LibSword.init();

const AvailableLanguages = [
  ...new Set(
    C.Locales.map((l) => {
      return l[0];
    })
      .map((l) => {
        return [l, l.replace(/-.*$/, '')];
      })
      .flat()
  ),
];

const init = async (lng: string) => {
  await G.i18n
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
        loadPath: `${G.Dirs.path.xsAsset}/locales/{{lng}}/{{ns}}.json`,
        // path to post missing resources
        addPath: `${G.Dirs.path.xsAsset}/locales/{{lng}}/{{ns}}.missing.json`,
        // jsonIndent to use when storing json files
        jsonIndent: 2,
      },
      saveMissing: C.isDevelopment,
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
      log.error(e);
    });

  // Do this in the background...
  // G.getSystemFonts();
};

const server = require('http').createServer();

const io = new Server(server);

io.on('connection', (socket) => {
  init('en');

  socket.on('error-report', (message: string) => {
    throw Error(message);
  });

  socket.on(
    'log',
    (type: LogLevel, windowID: string, json: string) => {
      log[type](windowID, ...JSON_parse(json));
    }
  );

  socket.on(
    'global',
    (name: keyof GType, args: any[], callback) => {
      callback(handleGlobal(-1, name, ...args));
    }
  );

});


io.listen(3000);

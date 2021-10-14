/* eslint-disable prettier/prettier */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import rendererBackend from 'i18next-electron-fs-backend';
import * as C from '../constants';

const isDevelopment =
  window.c.env.NODE_ENV() === 'development' || window.c.env.DEBUG_PROD() === 'true';

async function i18nInit(namespaces) {
  const R = window.ipc.renderer;

  const lang = R.sendSync('prefs', 'getCharPref', C.LOCALEPREF);
  const paths = R.sendSync('paths');

  await i18n
    .use(rendererBackend)
    // pass the i18n instance to react-i18next.
    .use(initReactI18next)
    // init i18next
    // for all options read: https://www.i18next.com/overview/configuration-options
    .init({
      lng: lang,
      fallbackLng: 'en',
      supportedLngs: ['en', 'ru'],

      ns: namespaces,

      debug: isDevelopment,

      backend: {
        // path where resources get loaded from
        loadPath: `${paths.assets}/locales/{{lng}}/{{ns}}.json`,
        // path to post missing resources
        addPath: `${paths.assets}/locales/{{lng}}/{{ns}}.missing.json`,
        // jsonIndent to use when storing json files
        jsonIndent: 2,
        ipcRenderer: window.api.i18nextElectronBackend,
      },
      saveMissing: !paths.assets.includes('resources'),
      saveMissingTo: 'current',

      react: {
        useSuspense: false,
      },

      interpolation: {
        escapeValue: false, // not needed for react as it escapes by default
      },
    });

  return i18n;
}

export default i18nInit;

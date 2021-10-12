/* eslint-disable prettier/prettier */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import backend from 'i18next-electron-fs-backend';

const paths = window.ipc.render.sendSync('paths');

i18n
  .use(backend)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    lng: 'cimode',
    fallbackLng: 'en',
    supportedLngs: ['en', 'ru'],

    debug: true,

    backend: {
      // path where resources get loaded from
      loadPath: `${paths.asar}/locales/{{lng}}/{{ns}}.json`,
      // path to post missing resources
      addPath: `${paths.asar}/locales/{{lng}}/{{ns}}.missing.json`,
      // jsonIndent to use when storing json files
      jsonIndent: 2,
      ipcRenderer: window.api.i18nextElectronBackend,
    },
    saveMissing: !paths.asar.includes('app.asar'),
    saveMissingTo: 'current',

    react: {
      useSuspense: false,
    },

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
  });

export default i18n;

/* eslint-disable prettier/prettier */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import backend from 'i18next-electron-fs-backend';
import * as C from '../constants';

async function i18nInit(namespaces) {
  const R = window.ipc.renderer;

  const lng = R.sendSync('prefs', 'getCharPref', C.LOCALEPREF);

  const paths = R.sendSync('paths');

  await i18n
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

  i18n.setDefaultNamespace(namespaces[0]);

  i18n
    .loadNamespaces(namespaces)
    .then(() => {
      i18n.changeLanguage(lng);
      return true;
    })
    .catch((e) => R.send('jsdump', e));

  return i18n;
}

export default i18nInit;

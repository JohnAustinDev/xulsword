/* eslint-disable prettier/prettier */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import rendererBackend from 'i18next-electron-fs-backend';
import C from '../constant';
import G from './gr';

const isDevelopment =
  window.c.process.NODE_ENV() === 'development' || window.c.process.DEBUG_PROD() === 'true';

const className = window.location.pathname.split('\\').pop().split('/').pop().split('.').shift();

function setBodyClass(winClass, lng) {
  const body = document?.getElementsByTagName('body')[0];

  if (!body) return false;

  body.className = `${winClass} ${lng}`;
  const dir = i18n.t('locale_direction');
  if (dir === 'rtl') body.classList.add('chromedir-rtl');
  return true;
}

i18n.on('initialized', (options) => {
  i18n.on('languageChanged', (lng) => {
    return setBodyClass(className, lng);
  });
  return setBodyClass(className, options.lng);
});

async function i18nInit(namespaces) {
  const lang = G.Prefs.getCharPref(C.LOCALEPREF);

  await i18n
    .use(rendererBackend)
    // pass the i18n instance to react-i18next.
    .use(initReactI18next)
    // init i18next
    // for all options read: https://www.i18next.com/overview/configuration-options
    .init({
      lng: lang,
      fallbackLng: 'en',
      supportedLngs: C.Languages,

      ns: namespaces.concat(['common/books', 'common/numbers']),

      debug: isDevelopment,

      backend: {
        // path where resources get loaded from
        loadPath: `${G.Dirs.path.xsAsset}/locales/{{lng}}/{{ns}}.json`,
        // path to post missing resources
        addPath: `${G.Dirs.path.xsAsset}/locales/{{lng}}/{{ns}}.missing.json`,
        // jsonIndent to use when storing json files
        jsonIndent: 2,
        ipcRenderer: window.api.i18nextElectronBackend,
      },
      saveMissing: !G.Dirs.path.xsAsset.includes('resources'),
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

/* eslint-disable prettier/prettier */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import rendererBackend from 'i18next-electron-fs-backend';
import C from '../constant';
import G from './rg';

const isDevelopment =
  window.shell.process.NODE_ENV() === 'development' || window.shell.process.DEBUG_PROD() === 'true';

const className = window.location.pathname.split('\\').pop().split('/').pop().split('.').shift();

function setHTMLClass(winClass, lng) {
  const html = document?.getElementsByTagName('html')[0];

  if (!html) return false;

  html.className = `${winClass} ${lng}`;

  const dir = i18n.t('locale_direction');
  html.classList.add(`chromedir-${dir}`);
  html.dir = dir;
  return true;
}

i18n.on('initialized', (options) => {
  i18n.on('languageChanged', (lng) => {
    return setHTMLClass(className, lng);
  });
  return setHTMLClass(className, options.lng);
});

async function i18nInit(namespaces) {
  const lang = G.Prefs.getCharPref(C.LOCALEPREF);

  let supportedLangs = G.Prefs.getComplexValue('global.locales').map((l) => {return l[0]});
  supportedLangs = [
    ...new Set(
      supportedLangs.concat(
        supportedLangs.map((l) => {
          return l.replace(/-.*$/, '');
        })
      )
    ),
  ];

  await i18n
    .use(rendererBackend)
    // pass the i18n instance to react-i18next.
    .use(initReactI18next)
    // init i18next
    // for all options read: https://www.i18next.com/overview/configuration-options
    .init({
      lng: lang,
      fallbackLng: 'en',
      supportedLngs: supportedLangs,

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

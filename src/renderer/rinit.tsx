/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/no-mutable-exports */
import React, { ReactElement, useEffect, useState } from 'react';
import { render } from 'react-dom';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import rendererBackend from 'i18next-electron-fs-backend';
import C from '../constant';
import Cache from '../cache';
import G from './rg';
import { jsdump } from './rutil';
import { delayHandler } from './libxul/xul';

window.ipc.renderer.on('cache-reset', () => Cache.clear);

// Set window type and language classes of the root html element.
i18n.on('initialized', (options) => {
  let className = 'unknown';
  const path = window?.location?.pathname;
  if (path) {
    const dirs = path.split('/');
    if (dirs.length) {
      const file = dirs.pop();
      if (file) {
        const parts = file.split('.');
        if (parts.length) [className] = parts;
      }
    }
  }
  function setHTMLClass(winclass: string, lng?: string) {
    const html = document?.getElementsByTagName('html')[0];
    if (!html) return false;
    const classes = [winclass];
    if (lng) classes.push(lng);
    html.className = classes.join(' ');
    const dir = i18n.t('locale_direction');
    html.classList.add(`chromedir-${dir}`);
    html.dir = dir;
    return true;
  }
  i18n.on('languageChanged', (lng) => {
    G.reset();
    return setHTMLClass(className, lng);
  });
  return setHTMLClass(className, options.lng);
});

async function i18nInit(namespaces: string[]) {
  const lang = G.Prefs.getCharPref(C.LOCALEPREF);

  let supportedLangs = G.Prefs.getComplexValue('global.locales').map(
    (l: string[]) => {
      return l[0];
    }
  );
  supportedLangs = [
    ...new Set(
      supportedLangs.concat(
        supportedLangs.map((l: string) => {
          return l.replace(/-.*$/, '');
        })
      )
    ),
  ];

  const isDevelopment =
    window.shell.process.NODE_ENV() === 'development' ||
    window.shell.process.DEBUG_PROD() === 'true';

  await i18n
    .use(rendererBackend)
    .use(initReactI18next)
    .init({
      lng: lang,
      fallbackLng: isDevelopment
        ? 'cimode'
        : C.FallbackLanguage[lang] || ['en'],
      supportedLngs: supportedLangs,
      preload: supportedLangs,

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

const delayHandlerThis = {};

export default function renderToRoot(
  component: ReactElement,
  loadedXUL?: () => void,
  unloadXUL?: () => void,
  namespace = 'xulsword'
) {
  function Reset(props: React.ComponentProps<any>) {
    const { children } = props;
    const [reset, setReset] = useState(0);
    useEffect(() => {
      return window.ipc.renderer.on('component-reset', () => {
        const lng = G.Prefs.getCharPref(C.LOCALEPREF);
        if (i18n.language !== lng) {
          i18n
            .loadLanguages(lng)
            .then(() => i18n.changeLanguage(lng))
            .then(() => {
              return setReset(reset + 1);
            })
            .catch((err: any) => {
              throw Error(err);
            });
        } else {
          G.reset();
          setReset(reset + 1);
        }
      });
    });
    useEffect(() => {
      return window.ipc.renderer.on(
        'resize',
        delayHandler.bind(delayHandlerThis)(
          () => {
            setReset(reset + 1);
          },
          C.UI.Window.resizeDelay,
          'resizeTO'
        )
      );
    });
    return <React.Fragment key={reset}>{children}</React.Fragment>;
  }

  i18nInit([namespace])
    .then(() =>
      render(<Reset>{component}</Reset>, document.getElementById('root'))
    )
    .then(() => {
      if (typeof loadedXUL === 'function') loadedXUL();
      window.ipc.renderer.send('window', 'did-finish-render');
      return true;
    })
    .catch((e: string | Error) => jsdump(e));

  window.ipc.renderer.on('close', () => {
    if (typeof unloadXUL === 'function') unloadXUL();
  });
}

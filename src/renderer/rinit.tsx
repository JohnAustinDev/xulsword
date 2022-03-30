/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/no-mutable-exports */
import React, { ReactElement, useEffect, useState } from 'react';
import { render } from 'react-dom';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import rendererBackend from 'i18next-electron-fs-backend';
import C from '../constant';
import { JSON_parse } from '../common';
import Cache from '../cache';
import G from './rg';
import DynamicStyleSheet from './style';
import { getContextData, jsdump } from './rutil';
import { delayHandler } from './libxul/xul';

import type { GlobalPref } from '../type';

import './global-htm.css';

window.ipc.renderer.on('cache-reset', () => Cache.clear);

DynamicStyleSheet.update(G.Data.read('stylesheetData'));
window.ipc.renderer.on('dynamic-stylesheet-reset', () =>
  DynamicStyleSheet.update(G.Data.read('stylesheetData'))
);

const winArgs = JSON_parse(window.shell.process.argv().at(-1));

// Set window type and language classes of the root html element.
i18n.on('initialized', (options) => {
  const classes = winArgs?.classes || ['unknown'];
  classes.push('cs-locale');
  function setHTMLClass(classarray: string[]) {
    const html = document?.getElementsByTagName('html')[0];
    if (!html) return false;
    html.className = classarray.join(' ');
    const dir = i18n.t('locale_direction');
    html.dir = dir;
    return true;
  }
  i18n.on('languageChanged', (lng) => {
    G.reset();
    return setHTMLClass(classes.concat(lng));
  });

  return setHTMLClass(classes.concat(options.lng));
});

async function i18nInit(namespaces: string[]) {
  const lang = G.Prefs.getCharPref('global.locale');

  const locales = G.Prefs.getComplexValue(
    'global.locales'
  ) as GlobalPref['global']['locales'];
  const supportedLangs = [
    ...new Set(
      locales
        .map((l) => {
          return l[0];
        })
        .map((l) => {
          return [l, l.replace(/-.*$/, '')];
        })
        .flat()
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
  loadedXUL?: (() => void) | null,
  unloadXUL?: (() => void) | null,
  namespace = 'xulsword'
) {
  function onContextMenu(e: React.SyntheticEvent) {
    G.Data.write(getContextData(e.target), 'contextData');
  }
  function Reset(props: React.ComponentProps<any>) {
    const { children } = props;
    const [reset, setReset] = useState(0);
    useEffect(() => {
      return window.ipc.renderer.on('component-reset', () => {
        DynamicStyleSheet.update(G.Data.read('stylesheetData'));
        const lng = G.Prefs.getCharPref('global.locale');
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
    return (
      <div id="reset" onContextMenu={onContextMenu} key={reset}>
        {children}
      </div>
    );
  }

  i18nInit([namespace])
    .then(() => {
      return render(
        <React.StrictMode>
          <Reset>{component}</Reset>
        </React.StrictMode>,
        document.getElementById('root')
      );
    })
    .then(() => {
      if (typeof loadedXUL === 'function') loadedXUL();
      setTimeout(() => {
        if (winArgs.type === 'dialog') {
          const body = document.getElementsByTagName('body');
          if (body.length) {
            const b = body[0].getBoundingClientRect();
            if (b) G.Window.setContentSize(b.width, b.height);
          }
        }
        window.ipc.renderer.send('did-finish-render');
      }, 1);
      return true;
    })
    .catch((e: string | Error) => jsdump(e));

  window.ipc.renderer.on('close', () => {
    if (typeof unloadXUL === 'function') unloadXUL();
  });
}

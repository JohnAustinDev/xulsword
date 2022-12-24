/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/forbid-prop-types */
/* eslint-disable jsx-a11y/iframe-has-title */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/no-mutable-exports */
import React, {
  ReactElement,
  StrictMode,
  SyntheticEvent,
  useEffect,
  useState,
} from 'react';
import { render } from 'react-dom';
import PropTypes from 'prop-types';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import rendererBackend from 'i18next-electron-fs-backend';
import { Intent, ProgressBar, Tag } from '@blueprintjs/core';
import Subscription from '../subscription';
import { JSON_parse, sanitizeHTML, stringHash } from '../common';
import Cache from '../cache';
import C from '../constant';
import G from './rg';
import DynamicStyleSheet from './style';
import log from './log';
import { getContextData } from './rutil';
import { delayHandler, xulCaptureEvents } from './libxul/xul';
import { Hbox } from './libxul/boxes';
import Dialog from './libxul/dialog';
import Spacer from './libxul/spacer';
import Button from './libxul/button';
import Label from './libxul/label';
import Textbox from './libxul/textbox';
import PrintOverlay from './libxul/printOverlay';

// Global CSS imports
import 'normalize.css/normalize.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import './global-htm.css';

import type { CipherKey, ModalType, NewModulesType } from '../type';
import type { SubscriptionType } from '../subscription';

// Init this render process log to the same settings as main.ts
const logLevel = C.LogLevel;
const { logInit, log: elog } = window.main;
logInit.consoleLevel(logLevel);
logInit.fileLevel(logLevel);
logInit.file(G.Dirs.path.ProfD, 'logs', 'xulsword.log');
elog.catchErrors({ onError: (er: Error) => log.error(er) });

const windesc = G.Window.description();
Cache.write(`${windesc.type}:${windesc.id}`, 'windowID');
log.debug(`Initializing new window`);

window.ipc.renderer.on('cache-reset', () => {
  Cache.clear();
  log.silly(`CLEARED ALL CACHES`);
  Cache.write(`${windesc.type}:${windesc.id}`, 'windowID');
});

DynamicStyleSheet.update(G.Data.read('stylesheetData'));
window.ipc.renderer.on('dynamic-stylesheet-reset', () =>
  DynamicStyleSheet.update(G.Data.read('stylesheetData'))
);

const winArgs = JSON_parse(window.main.process.argv().at(-1) || '{}');

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
    Cache.clear();
    return setHTMLClass(classes.concat(lng));
  });

  return setHTMLClass(classes.concat(options.lng));
});

async function i18nInit(namespaces: string[]) {
  const lang = G.Prefs.getCharPref('global.locale');

  const supportedLangs = [
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

  await i18n
    .use(rendererBackend)
    .use(initReactI18next)
    .init({
      lng: lang,
      fallbackLng: C.FallbackLanguage[lang] || ['en'],
      supportedLngs: supportedLangs,
      preload: supportedLangs,

      ns: namespaces.concat(['common/books', 'common/numbers', 'branding']),

      debug: C.isDevelopment,

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

const defaultProps = {
  resetOnResize: true,
  printControl: null,
  dialogInitial: [],
  initialPrintOverlay: null,
};
const propTypes = {
  children: PropTypes.element.isRequired,
  resetOnResize: PropTypes.bool,
  printControl: PropTypes.object,
  initialState: PropTypes.object,
};
type WindowRootProps = {
  children: ReactElement;
  resetOnResize?: boolean;
  printControl?: ReactElement | null;
  initialState?: Partial<WindowRootState>;
};

const initialState = {
  reset: 0 as number,
  dialogs: [] as ReactElement[],
  showPrintOverlay: false as boolean,
  modal: 'off' as ModalType,
  iframeFilePath: '' as string,
  printDisabled: false as boolean,
  progress: -1 as number | 'undefined',
};

// Key order must never change for React hooks to work!
const stateme = Object.keys(initialState) as (keyof typeof initialState)[];

export type WindowRootState = typeof initialState;

type StateArray<M extends keyof WindowRootState> = [
  WindowRootState[M],
  (a: WindowRootState[M]) => void
];

const delayHandlerThis = {};

function WindowRoot(props: WindowRootProps) {
  const {
    children,
    resetOnResize,
    printControl,
    initialState: initialStateProp,
  } = props;
  const istate = { ...initialState, ...initialStateProp };

  const s = {} as { [k in keyof typeof initialState]: StateArray<k> };
  stateme.forEach((me) => {
    s[me] = useState(istate[me]) as any;
  });

  const textbox: React.RefObject<HTMLInputElement> = React.createRef();

  // IPC component-reset setup:
  useEffect(() => {
    return window.ipc.renderer.on('component-reset', () => {
      DynamicStyleSheet.update(G.Data.read('stylesheetData'));
      const lng = G.Prefs.getCharPref('global.locale');
      if (i18n.language !== lng) {
        i18n
          .loadLanguages(lng)
          .then(() => i18n.changeLanguage(lng))
          .then(() => {
            return s.reset[1](s.reset[0] + 1);
          })
          .catch((err: any) => {
            throw Error(err);
          });
      } else {
        Cache.clear();
        s.reset[1](s.reset[0] + 1);
      }
    });
  });

  // Modal overlay:
  useEffect(() => {
    return window.ipc.renderer.on('modal', (cssclass: ModalType) => {
      s.modal[1](cssclass);
    });
  });

  // Set Window State:
  useEffect(() => {
    return Subscription.subscribe.setWindowRootState((state) => {
      Object.entries(state).forEach((entry) => {
        const [sp, v] = entry;
        const S = sp as keyof typeof initialState;
        const val = v as any;
        if (val !== undefined) {
          const setMe = s[S][1] as (a: any) => any;
          setMe(val);
        }
      });
    });
  });

  // Progress meter:
  useEffect(() => {
    return window.ipc.renderer.on('progress', (prog: number, id?: string) => {
      if (!id) s.progress[1](prog);
    });
  });

  // IPC resize setup:
  useEffect(() => {
    if (resetOnResize) {
      return window.ipc.renderer.on(
        'resize',
        delayHandler.bind(delayHandlerThis)(
          () => {
            s.reset[1](s.reset[0] + 1);
          },
          C.UI.Window.resizeDelay,
          'resizeTO'
        )
      );
    }
    return () => {};
  });

  // Publish arbitrary subscription:
  useEffect(() => {
    return window.ipc.renderer.on(
      'publish-subscription',
      (subscription: keyof SubscriptionType['publish'], ...args: any) => {
        Subscription.doPublish(subscription, ...args);
      }
    );
  });

  // Installer drag-and-drop setup:
  useEffect(() => {
    const root = document.getElementById('root');
    if (
      root &&
      ['xulsword', 'viewportWin'].includes(G.Window.description().type ?? '')
    ) {
      root.ondragover = (e) => {
        e.preventDefault();
        s.modal[1]('outlined');
      };
      root.ondragleave = (e) => {
        e.preventDefault();
        if (!root.contains(e.relatedTarget as HTMLElement)) s.modal[1]('off');
      };
      root.ondrop = (e) => {
        e.preventDefault();
        if (e.dataTransfer?.files.length) {
          G.Commands.installXulswordModules(
            Array.from(e.dataTransfer.files).map((f) => f.path) || []
          ).catch((err) => {
            throw Error(err);
          });
        } else {
          s.modal[1]('off');
        }
      };
    }
    return () => {
      if (root) {
        root.ondrop = null;
        root.ondragover = null;
        root.ondragleave = null;
      }
    };
  });

  // Modal warn/error/cipher-keys dialog on modulesInstalled:
  useEffect(() => {
    return Subscription.subscribe.modulesInstalled(
      (newmods: NewModulesType) => {
        const dialog: ReactElement[] = [];
        const cipherKeys: CipherKey[] = [];
        const setCipherKey = () => {
          const k = cipherKeys.filter((ck) => ck.conf.module && ck.cipherKey);
          if (k.length && !s.dialogs[0].length) {
            G.Module.setCipherKeys(k, G.Window.description().id);
            s.modal[1]('darkened'); // so there's no flash
          }
        };
        const haserror = newmods.reports.some((r) => r.error);
        const haswarning = newmods.reports.some((r) => r.warning);
        if (haserror) G.Shell.beep();
        if (haserror || haswarning) {
          dialog.push(
            <Dialog
              className="modulesInstalled"
              body={
                <>
                  {newmods.reports.map((r) =>
                    Object.entries(r).map((entry) => {
                      const [type, msg] = entry;
                      return (
                        <Tag
                          key={[type, stringHash(msg)].join('.')}
                          icon={type === 'error' ? 'error' : 'warning-sign'}
                          intent={
                            type === 'error' ? Intent.DANGER : Intent.WARNING
                          }
                          multiline
                        >
                          {msg}
                        </Tag>
                      );
                    })
                  )}
                </>
              }
              buttons={
                <>
                  <Spacer flex="10" />
                  <Button
                    flex="1"
                    fill="x"
                    onClick={() => s.dialogs[1](s.dialogs[0].splice(0, 1))}
                  >
                    {i18n.t('ok.label')}
                  </Button>
                </>
              }
            />
          );
        }
        newmods.nokeymods.forEach((conf) => {
          dialog.push(
            <Dialog
              className="cipher-prompt"
              body={
                <>
                  <div className={`head1 cs-${conf.module}`}>
                    {`${conf.module} ${conf.Version}`}
                  </div>
                  <div>{conf.Description?.locale}</div>
                  {!!conf.UnlockInfo?.locale && (
                    <div
                      className="publisher-msg"
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHTML(conf.UnlockInfo?.locale),
                      }}
                    />
                  )}
                  <Label value={i18n.t('cipherKey.prompt')} />
                  <Textbox maxLength="32" inputRef={textbox} />
                </>
              }
              buttons={
                <>
                  <Spacer flex="10" />
                  <Button
                    flex="1"
                    fill="x"
                    onClick={() => {
                      cipherKeys.push({
                        conf,
                        cipherKey: textbox.current?.value ?? '',
                      });
                      s.dialogs[1](s.dialogs[0].splice(0, 1));
                      setCipherKey();
                    }}
                  >
                    {i18n.t('ok.label')}
                  </Button>
                </>
              }
            />
          );
        });
        if (dialog.length) {
          s.dialogs[1](dialog);
        }
      }
    );
  });

  const overlay =
    s.progress[0] !== -1 || s.modal[0] !== 'off' ? (
      <Hbox
        id="overlay"
        className={s.modal[0]}
        pack="center"
        align="center"
        {...xulCaptureEvents.reduce((p: any, c) => {
          p[c] = (ev: SyntheticEvent) => {
            ev.preventDefault();
            ev.stopPropagation();
          };
          return p;
        }, {})}
      >
        {s.progress[0] !== -1 && (
          <ProgressBar
            className="modal-progressbar"
            value={s.progress[0] === 'undefined' ? undefined : s.progress[0]}
            intent="primary"
            animate
            stripes
          />
        )}
      </Hbox>
    ) : null;

  const content = (
    <>
      {overlay}
      {s.dialogs[0].length > 0 && s.dialogs[0][0]}
      <div
        key={s.reset[0]}
        id="reset"
        className={s.showPrintOverlay[0] ? 'printp' : undefined}
        onContextMenu={(e: React.SyntheticEvent) => {
          G.Data.write(getContextData(e.target), 'contextData');
        }}
      >
        {children}
      </div>
    </>
  );

  if (s.showPrintOverlay[0]) {
    return (
      <PrintOverlay
        content={content}
        customControl={printControl}
        printDisabled={s.printDisabled[0]}
        iframeFilePath={s.iframeFilePath[0]}
      />
    );
  }

  return content;
}
WindowRoot.defaultProps = defaultProps;
WindowRoot.propTypes = propTypes;

export default async function renderToRoot(
  component: ReactElement,
  options?: {
    namespace?: string;
    resetOnResize?: boolean;
    printControl?: ReactElement;
    initialWindowRootState?: Partial<WindowRootState>;
    onload?: (() => void) | null;
    onunload?: (() => void) | null;
  }
) {
  const {
    namespace,
    resetOnResize,
    printControl,
    initialWindowRootState,
    onload,
    onunload,
  } = options || {};

  window.ipc.renderer.on('close', () => {
    if (typeof onunload === 'function') onunload();
    Cache.clear();
  });

  await i18nInit([namespace ?? 'xulsword']);
  render(
    <StrictMode>
      <WindowRoot
        resetOnResize={resetOnResize}
        printControl={printControl}
        initialState={initialWindowRootState}
      >
        {component}
      </WindowRoot>
    </StrictMode>,
    document.getElementById('root')
  );
  if (typeof onload === 'function') onload();
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
}

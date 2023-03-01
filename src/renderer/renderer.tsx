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
import { Intent, ProgressBar, Tag } from '@blueprintjs/core';
import Subscription from '../subscription';
import { JSON_parse, sanitizeHTML, stringHash } from '../common';
import Cache from '../cache';
import C from '../constant';
import G from './rg';
import DynamicStyleSheet from './style';
import log from './log';
import { getContextData } from './bookmarks';
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

window.onerror = (errorMsg, url, line) => {
  log.error(`${errorMsg} at: ${url} line: ${line}`);
  return false;
};

const windesc = G.Window.description();
Cache.write(`${windesc.type}:${windesc.id}`, 'windowID');
log.debug(`Initializing new window`);

window.ipc.on('cache-reset', () => {
  Cache.clear();
  log.silly(`CLEARED ALL CACHES`);
  Cache.write(`${windesc.type}:${windesc.id}`, 'windowID');
});

DynamicStyleSheet.update(G.Data.read('stylesheetData'));
window.ipc.on('dynamic-stylesheet-reset', () =>
  DynamicStyleSheet.update(G.Data.read('stylesheetData'))
);

const winArgs = JSON_parse(window.processR.argv().at(-1) || '{}');

// Set window type and language classes of the root html element.
const classes = winArgs?.classes || ['unknown'];
classes.push('cs-locale');
classes.push(G.i18n.language);
const html = document?.getElementsByTagName('html')[0];
if (html) {
  html.className = classes.join(' ');
  const dir = G.i18n.t('locale_direction');
  html.dir = dir;
}

const defaultProps = {
  resetOnResize: true,
  printControl: null,
  initialState: {},
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
    return window.ipc.on('component-reset', () => {
      DynamicStyleSheet.update(G.Data.read('stylesheetData'));
      Cache.clear();
      s.reset[1](s.reset[0] + 1);
    });
  });

  // Modal overlay:
  useEffect(() => {
    return window.ipc.on('modal', (cssclass: ModalType) => {
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
    return window.ipc.on('progress', (prog: number, id?: string) => {
      if (!id) s.progress[1](prog);
    });
  });

  // IPC resize setup:
  useEffect(() => {
    if (resetOnResize) {
      return window.ipc.on(
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
    return window.ipc.on(
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
        DynamicStyleSheet.update(G.Data.read('stylesheetData'));
        Cache.clear();
        s.reset[1](s.reset[0] + 1);
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
        if (haserror || (C.isDevelopment && haswarning)) {
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
                    {G.i18n.t('ok.label')}
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
                  <Label value={G.i18n.t('cipherKey.prompt')} />
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
                    {G.i18n.t('ok.label')}
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
        className={s.progress[0] !== -1 ? 'darkened' : s.modal[0]}
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
          G.Data.write(getContextData(e.target as HTMLElement), 'contextData');
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
    resetOnResize,
    printControl,
    initialWindowRootState,
    onload,
    onunload,
  } = options || {};

  window.ipc.on('close', () => {
    if (typeof onunload === 'function') onunload();
    Cache.clear();
  });

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
    window.ipc.send('did-finish-render');
  }, 1);
}

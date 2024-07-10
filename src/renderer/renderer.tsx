import React, { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import PropTypes from 'prop-types';
import { Intent, ProgressBar, Spinner, Tag } from '@blueprintjs/core';
import Subscription from '../subscription.ts';
import { randomID, sanitizeHTML, stringHash } from '../common.ts';
import Cache from '../cache.ts';
import C from '../constant.ts';
import G from './rg.ts';
import DynamicStyleSheet from './style.ts';
import ContextData from './contextData.ts';
import { windowArguments } from './rutil.ts';
import log from './log.ts';
import { delayHandler, xulCaptureEvents } from './libxul/xul.tsx';
import { Hbox } from './libxul/boxes.tsx';
import Dialog from './libxul/dialog.tsx';
import Spacer from './libxul/spacer.tsx';
import Button from './libxul/button.tsx';
import Label from './libxul/label.tsx';
import Textbox from './libxul/textbox.tsx';
import PrintOverlay from './libxul/printOverlay.tsx';

// Global CSS imports
import 'normalize.css/normalize.css';
import '@blueprintjs/icons/lib/css/blueprint-icons.css';
import '@blueprintjs/core/lib/css/blueprint.css';
import './global-htm.css';

import type { ReactElement, SyntheticEvent } from 'react';
import type {
  CipherKey,
  ModalType,
  NewModulesType,
  WindowDescriptorPrefType,
} from '../type.ts';
import type { SubscriptionType } from '../subscription.ts';
import type { StyleType } from './style.ts';

const descriptor = windowArguments();
Cache.write(`${descriptor.type}:${descriptor.id}`, 'windowID');
log.debug(`Initializing new window:`, descriptor);

window.onerror = (er, url, line) => {
  const er2 = typeof er === 'object' ? er.type : er;
  const msg = `${er2} at: ${url} line: ${line}`;
  window.ipc.send('error-report', msg);
  return false;
};

window.addEventListener('unhandledrejection', (event) => {
  const reason =
    typeof event.reason === 'string' ? event.reason : event.reason.stack;
  const msg = `Unhandled renderer rejection: ${reason}`;
  window.ipc.send('error-report', msg);
});

window.ipc.on('cache-reset', () => {
  Cache.clear();
  log.debug(`CLEARED ALL CACHES`);
  Cache.write(`${descriptor.type}:${descriptor.id}`, 'windowID');
});

const dynamicStyleSheet = new DynamicStyleSheet(document);

dynamicStyleSheet.update(G.Data.read('stylesheetData') as StyleType);
window.ipc.on('dynamic-stylesheet-reset', () => {
  dynamicStyleSheet.update(G.Data.read('stylesheetData') as StyleType);
});

// Set window type and language classes on the root html element.
const classes: string[] = [];
const classArgs = [
  'className',
  'type',
  'fitToContent',
  'notResizable',
] as const;
classArgs.forEach((p: keyof WindowDescriptorPrefType) => {
  const s = p in descriptor ? descriptor[p] : undefined;
  if (s !== undefined && typeof s === 'boolean' && s) classes.push(p);
  else if (s !== undefined && typeof s === 'string') classes.push(s);
});
classes.push('cs-locale');
classes.push(G.i18n.language);
const html = document?.getElementsByTagName('html')[0];
if (html) {
  html.className = classes.join(' ');
  const dir = G.i18n.t('locale_direction');
  html.dir = dir;
}

const propTypes = {
  print: PropTypes.object.isRequired,
  initialState: PropTypes.object.isRequired,
  children: PropTypes.element.isRequired,
};

const InitialState = {
  reset: '' as string,
  dialogs: [] as ReactElement[],
  showPrintOverlay: false as boolean,
  printDisabled: false,
  modal: 'off' as ModalType,
  iframeFilePath: '' as string,
  resetOnResize: true as boolean,
  progress: -1 as number | 'indefinite',
};

export type WindowRootState = typeof InitialState;

type WindowRootProps = WindowRootOptions & {
  isPrintContainer: boolean;
  children: ReactElement;
};

// Key order must never change for React hooks to work!
const stateme = Object.keys(InitialState) as Array<keyof typeof InitialState>;

type StateArray<M extends keyof WindowRootState> = [
  WindowRootState[M],
  (a: WindowRootState[M]) => void,
];

const delayHandlerThis = {};

function WindowRoot(props: WindowRootProps) {
  const { children, print, isPrintContainer, initialState: istate } = props;

  const s = {} as { [k in keyof typeof InitialState]: StateArray<k> };
  stateme.forEach((me) => {
    s[me] = useState(istate[me]) as any;
  });

  const textbox: React.RefObject<HTMLInputElement> = React.createRef();

  // IPC component-reset setup:
  useEffect(() => {
    return window.ipc.on('component-reset', () => {
      log.debug(
        `Renderer reset (stylesheet, cache, component): ${descriptor.id}`,
      );
      dynamicStyleSheet.update(G.Data.read('stylesheetData') as StyleType);
      Cache.clear();
      s.reset[1](randomID());
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
    return Subscription.subscribe.setRendererRootState((state) => {
      Object.entries(state).forEach((entry) => {
        const [sp, v] = entry;
        const S = sp as keyof typeof InitialState;
        const val = v as any;
        if (val !== undefined) {
          const setMe = s[S][1] as (a: any) => any;
          if (state.showPrintOverlay === true && S === 'reset') {
            setTimeout(() => setMe(val), 1);
          } else setMe(val);
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
    if (
      (s.resetOnResize[0] || s.showPrintOverlay[0]) &&
      s.dialogs[0].length === 0
    ) {
      return window.ipc.on(
        'resize',
        delayHandler.bind(delayHandlerThis)(
          () => {
            log.debug(`Renderer reset (component): ${descriptor.id}`);
            s.reset[1](randomID());
          },
          C.UI.Window.resizeDelay,
          'resizeTO',
        ),
      );
    }
    return () => {};
  });

  // Publish arbitrary subscription:
  useEffect(() => {
    return window.ipc.on(
      'publish-subscription',
      (subscription: keyof SubscriptionType['publish'], ...args: unknown[]) => {
        Subscription.doPublish(subscription, ...args);
      },
    );
  });

  // Installer drag-and-drop setup:
  useEffect(() => {
    const root = document.getElementById('root');
    if (
      root &&
      ['xulswordWin', 'viewportWin'].includes(descriptor.type ?? '')
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
            Array.from(e.dataTransfer.files).map((f) => f.path) || [],
          ).catch((er) => {
            log.error(er);
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
        log.debug(
          `Renderer reset (cache, stylesheet, component): ${descriptor.id}`,
        );
        dynamicStyleSheet.update(G.Data.read('stylesheetData') as StyleType);
        Cache.clear();
        s.reset[1](randomID());
        const dialog: ReactElement[] = [];
        const cipherKeys: CipherKey[] = [];
        const setCipherKey = () => {
          const k = cipherKeys.filter((ck) => ck.conf.module && ck.cipherKey);
          if (k.length && !s.dialogs[0].length) {
            G.Module.setCipherKeys(k, descriptor.id);
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
                    }),
                  )}
                </>
              }
              buttons={
                <>
                  <Spacer flex="10" />
                  <Button
                    flex="1"
                    fill="x"
                    onClick={() => {
                      s.dialogs[1](s.dialogs[0].splice(0, 1));
                    }}
                  >
                    {G.i18n.t('ok.label')}
                  </Button>
                </>
              }
            />,
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
            />,
          );
        });
        if (dialog.length) {
          s.dialogs[1](dialog);
        }
      },
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
        {s.progress[0] !== -1 && s.progress[0] !== 'indefinite' && (
          <div className="progress-container progressbar">
            <ProgressBar
              value={s.progress[0]}
              intent="primary"
              animate
              stripes
            />
          </div>
        )}
        {s.progress[0] !== -1 && s.progress[0] === 'indefinite' && (
          <div className="progress-container spinner">
            <Spinner intent={Intent.PRIMARY} />
          </div>
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
          if (!G.Data.has('contextData')) {
            G.Data.write(ContextData(e.target as HTMLElement), 'contextData');
          }
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
        print={print}
        isPrintContainer={isPrintContainer}
        printDisabled={s.printDisabled[0]}
        iframeFilePath={s.iframeFilePath[0]}
      />
    );
  }

  return content;
}
WindowRoot.propTypes = propTypes;

export type RootPrintType = {
  pageable: boolean;
  dialogEnd: 'cancel' | 'close';
  pageView: React.RefObject<HTMLDivElement>;
  printContainer: React.RefObject<HTMLDivElement>;
  controls: React.RefObject<HTMLDivElement>;
  settings: React.RefObject<HTMLDivElement>;
};

export type WindowRootOptions = {
  print: RootPrintType;
  initialState: Partial<WindowRootState>;
  onload?: (() => void) | null;
  onunload?: (() => void) | null;
};

export default async function renderToRoot(
  component: ReactElement,
  options?: Partial<Omit<WindowRootOptions, 'print'>> & {
    print?: Partial<RootPrintType>;
  },
) {
  const { onload, onunload } = options || {};
  const { print: printArg, initialState: initialStateArg } = options || {};
  const print: RootPrintType = {
    pageable: false,
    dialogEnd: 'cancel' as const,
    pageView: React.createRef(),
    printContainer: React.createRef(),
    controls: React.createRef(),
    settings: React.createRef(),
    ...printArg,
  };
  const initialState = {
    ...InitialState,
    ...initialStateArg,
  };

  const root = createRoot(document.getElementById('root') as HTMLElement);

  root.render(
    <StrictMode>
      <WindowRoot
        print={print}
        isPrintContainer={!options?.print?.printContainer}
        initialState={initialState}
      >
        {component}
      </WindowRoot>
    </StrictMode>,
  );

  window.onbeforeunload = () => {
    if (typeof onunload === 'function') onunload();
    Cache.clear();
  };

  if (typeof onload === 'function') onload();

  setTimeout(() => {
    if (descriptor?.fitToContent) {
      const htmlElem = document.getElementsByTagName('html')[0];
      const bodyElem = document.getElementsByTagName('body')[0];
      if (htmlElem && bodyElem) {
        const b = bodyElem.getBoundingClientRect();
        if (b) G.Window.setContentSize(b.width, b.height);
        // Now that the window has been resized, remove the fitToContent
        // class so content will fill the window even if it shrinks.
        htmlElem.classList.remove('fitToContent');
      }
    }
    window.ipc.send('did-finish-render');
  }, 1);
}

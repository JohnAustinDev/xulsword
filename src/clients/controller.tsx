import React, { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Intent, ProgressBar, Spinner, Tag } from '@blueprintjs/core';
import Subscription from '../subscription.ts';
import { randomID, sanitizeHTML, stringHash } from '../common.ts';
import Cache from '../cache.ts';
import C from '../constant.ts';
import { G } from './G.ts';
import DynamicStyleSheet from './style.ts';
import ContextData from './contextData.ts';
import { windowArguments } from './common.tsx';
import log from './log.ts';
import {
  delayHandler,
  xulCaptureEvents,
  addClass,
} from './components/libxul/xul.tsx';
import Print, { PrintContainer } from './components/libxul/print.tsx';
import { Hbox } from './components/libxul/boxes.tsx';
import Search, { SearchProps } from './components/search/search.tsx';
import PrintPassage from './components/printPassage/printPassage.tsx';
import Dialog from './components/libxul/dialog.tsx';
import Spacer from './components/libxul/spacer.tsx';
import Button from './components/libxul/button.tsx';
import Label from './components/libxul/label.tsx';
import Textbox from './components/libxul/textbox.tsx';

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
import type { PrintPassageProps } from './components/printPassage/printPassage.tsx';

// This top level controller takes one or more components as children and
// provides window level services and communication for those components.
// Both controller props and defaultControllerState become state variables
// and so may be updated using Subscription.publish.setControllerState().

type CardTypes =
  | { name: 'search'; props: SearchProps }
  | { name: 'printPassage'; props: PrintPassageProps };

type ControllerProps = {
  resetOnResize: boolean;
  print: PrintOptionsType | null;
  children: ReactElement;
};

const defaultControllerState = {
  reset: '' as string,
  dialogs: [] as ReactElement[],
  card: null as CardTypes | null,
  modal: 'off' as ModalType,
  progress: -1 as number | 'indefinite',
};

export type ControllerState = Omit<ControllerProps, 'children'> &
  typeof defaultControllerState;

// Key order must never change for React hooks to work!
const stateK = Object.keys(defaultControllerState) as Array<
  keyof typeof defaultControllerState
>;
const propsK: Array<keyof ControllerState> = ['resetOnResize', 'print'];
const stateKeys = propsK.concat(stateK) as Array<keyof ControllerState>;

type StateArray<M extends (typeof stateKeys)[number]> = [
  ControllerState[M],
  (a: ControllerState[M]) => void,
];

let descriptor: WindowDescriptorPrefType | null = null;
let dynamicStyleSheet: DynamicStyleSheet | null = null;
const delayHandlerThis = {};

function Controller(props: ControllerProps) {
  const { children } = props;
  const s0 = { ...defaultControllerState, ...props };
  const s = {} as { [k in keyof ControllerState]: StateArray<k> };
  stateKeys.forEach((me) => {
    s[me] = useState(s0[me]) as any;
  });

  // Print must be activated when printPassage card is shown.
  if (s.card[0] && s.card[0].name === 'printPassage' && !s.print[0]) {
    s.print[1]({ dialogEnd: 'close', pageable: true });
    return null;
  }

  const textbox: React.RefObject<HTMLInputElement> = React.createRef();

  // IPC component-reset setup:
  useEffect(() => {
    return window.IPC.on('component-reset', () => {
      if (dynamicStyleSheet) {
        log.debug(
          `Renderer reset (stylesheet, cache, component): ${descriptor?.id || 'unknown'}`,
        );
        const st = Build.isElectronApp
          ? (G.Data.read('stylesheetData') as StyleType)
          : undefined;
        dynamicStyleSheet.update(st);
        Cache.clear();
        s.reset[1](randomID());
      }
    });
  });

  // Modal overlay:
  useEffect(() => {
    return window.IPC.on('modal', (cssclass: ModalType) => {
      s.modal[1](cssclass);
    });
  });

  // Set Window State:
  useEffect(() => {
    return Subscription.subscribe.setControllerState(
      (state, mergeValue = false) => {
        Object.entries(state).forEach((entry) => {
          const [sp, v] = entry;
          const S = sp as keyof ControllerState;
          let val = v as any;
          const [v0] = s[S];
          // If mergeValue is set, and both old and new values are objects,
          // then merge their keys to form the new value (useful for print).
          if (
            mergeValue &&
            val &&
            typeof val === 'object' &&
            v0 &&
            typeof v0 === 'object'
          ) {
            val = { ...v0, ...val };
          }
          if (S === 'dialogs' || stringHash(v0) !== stringHash(val)) {
            const setMe = s[S][1] as (a: any) => void;
            if (state.print !== null && S === 'reset') {
              setTimeout(() => setMe(val), 1);
            } else setMe(val);
          }
        });
      },
    );
  });

  // Progress meter:
  useEffect(() => {
    return window.IPC.on('progress', (prog: number, id?: string) => {
      if (!id) s.progress[1](prog);
    });
  });

  // IPC resize setup:
  useEffect(() => {
    if ((s.resetOnResize[0] || s.print[0]) && s.dialogs[0].length === 0) {
      return window.IPC.on(
        'resize',
        delayHandler.bind(delayHandlerThis)(
          () => {
            log.debug(
              `Renderer reset (component): ${descriptor?.id || 'unknown'}`,
            );
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
    return window.IPC.on(
      'publish-subscription',
      (subscription: keyof SubscriptionType['publish'], ...args: unknown[]) => {
        Subscription.doPublish(subscription, ...args);
      },
    );
  });

  // Installer drag-and-drop setup:
  useEffect(() => {
    if (!Build.isElectronApp) return;
    const root = document.getElementById('root');
    if (
      root &&
      ['xulswordWin', 'viewportWin'].includes(descriptor?.type ?? '')
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
        if (!Build.isElectronApp) return;
        log.debug(
          `Renderer reset (cache, stylesheet, component): ${descriptor?.id || 'unknown'}`,
        );
        const st = Build.isElectronApp
          ? (G.Data.read('stylesheetData') as StyleType)
          : undefined;
        dynamicStyleSheet?.update(st);
        Cache.clear();
        s.reset[1](randomID());
        const dialog: ReactElement[] = [];
        const cipherKeys: CipherKey[] = [];
        const setCipherKey = () => {
          const k = cipherKeys.filter((ck) => ck.conf.module && ck.cipherKey);
          if (k.length && !s.dialogs[0].length) {
            G.Module.setCipherKeys(k, descriptor?.id);
            s.modal[1]('darkened'); // so there's no flash
          }
        };
        const haserror = newmods.reports.some((r) => r.error);
        const haswarning = newmods.reports.some((r) => r.warning);
        if (haserror) G.Shell.beep();
        if (haserror || (Build.isDevelopment && haswarning)) {
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
                      dangerouslySetInnerHTML={{
                        // eslint-disable-next-line @typescript-eslint/naming-convention
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

  const modal = s.print[0] ? 'dropshadow' : s.modal[0];
  const progressAndModalOverlay =
    s.progress[0] !== -1 || modal !== 'off' ? (
      <Hbox
        id="overlay"
        className={s.progress[0] !== -1 ? 'darkened' : modal}
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

  let content = children;
  if (s.card[0]) {
    const closeButton = (
      <Button
        className="close-card-button"
        icon="cross"
        onClick={() =>
          Subscription.publish.setControllerState({
            reset: randomID(),
            card: null,
          })
        }
      />
    );
    switch (s.card[0].name) {
      case 'search': {
        content = (
          <>
            {closeButton}
            <Search {...addClass('searchCard', s.card[0].props)} />
          </>
        );
        break;
      }
      case 'printPassage': {
        content = (
          <>
            {closeButton}
            <PrintPassage {...addClass('printPassageCard', s.card[0].props)} />
          </>
        );
        break;
      }
    }
  }
  if (s.print[0]?.pageable)
    content = <PrintContainer>{content}</PrintContainer>;

  const root = (
    <>
      {progressAndModalOverlay}
      {s.dialogs[0].length > 0 && s.dialogs[0][0]}
      <div
        key={s.reset[0]}
        id="reset"
        onContextMenu={(e: React.SyntheticEvent) => {
          if (Build.isElectronApp) {
            if (!G.Data.has('contextData')) {
              G.Data.write(ContextData(e.target as HTMLElement), 'contextData');
            }
          }
        }}
      >
        {content}
      </div>
    </>
  );

  return s.print[0] ? <Print print={s.print[0]}>{root}</Print> : root;
}

export type PrintOptionsType = {
  dialogEnd: 'cancel' | 'close';
  pageable?: boolean;
  printDisabled?: boolean;
  iframeFilePath?: string;
  direction?: 'ltr' | 'rtl' | 'auto';
};

export type RootOptionsType = {
  htmlCssClass: string;
  resetOnResize: boolean;
  print: PrintOptionsType | null;
  onload: (() => void) | null;
  onunload: (() => void) | null;
};

export default async function renderToRoot(
  component: ReactElement,
  options?: Partial<RootOptionsType>,
) {
  const { print, resetOnResize, htmlCssClass, onload, onunload } =
    options || {};

  log.debug(`Initializing new window:`, descriptor);

  // On web clients, IPC is not available until the socket is connected.
  window.addEventListener('error', (e) => log.error(e));
  window.addEventListener('unhandledrejection', (e) => log.error(e));
  window.IPC.on('cache-reset', () => {
    Cache.clear();
    log.debug(`CLEARED ALL CACHES`);
    Cache.write(
      `${descriptor?.type || 'unknown'}:${descriptor?.id || 'unknown'}`,
      'windowID',
    );
  });
  window.IPC.on('dynamic-stylesheet-reset', () => {
    const st = Build.isElectronApp
      ? (G.Data.read('stylesheetData') as StyleType)
      : undefined;
    dynamicStyleSheet?.update(st);
  });

  descriptor = windowArguments();
  Cache.write(`${descriptor.type}:${descriptor.id}`, 'windowID');

  dynamicStyleSheet = new DynamicStyleSheet(document);
  const st = Build.isElectronApp
    ? (G.Data.read('stylesheetData') as StyleType)
    : undefined;
  dynamicStyleSheet.update(st);

  // Set window type and language classes on the root html element.
  const classes: string[] = htmlCssClass ? [htmlCssClass] : [];
  if (Build.isElectronApp) classes.push('isElectron');
  if (Build.isWebApp) classes.push('isWebApp');
  const classArgs = [
    'className',
    'type',
    'fitToContent',
    'notResizable',
  ] as const;
  classArgs.forEach((p: keyof WindowDescriptorPrefType) => {
    const s = descriptor && p in descriptor ? descriptor[p] : undefined;
    if (s !== undefined && typeof s === 'boolean' && s) classes.push(p);
    else if (s !== undefined && typeof s === 'string') classes.push(s);
  });
  classes.push('cs-locale');
  classes.push(G.i18n.language);
  if (frameElement) classes.push('iframe');
  if (frameElement?.classList.contains('auto-height'))
    classes.push('auto-height');
  const html = document?.getElementsByTagName('html')[0];
  if (html) {
    html.className = classes.join(' ');
    const dir = G.i18n.t('locale_direction');
    html.dir = dir;
  }

  const root = createRoot(document.getElementById('root') as HTMLElement);

  root.render(
    <StrictMode>
      <Controller print={print ?? null} resetOnResize={resetOnResize ?? true}>
        {component}
      </Controller>
    </StrictMode>,
  );

  window.onbeforeunload = () => {
    if (typeof onunload === 'function') onunload();
    Cache.clear();
  };

  if (typeof onload === 'function') onload();

  setTimeout(() => {
    if (descriptor?.fitToContent) {
      const [htmlElem] = Array.from(document.getElementsByTagName('html'));
      const [bodyElem] = Array.from(document.getElementsByTagName('body'));
      if (htmlElem && bodyElem) {
        const b = bodyElem.getBoundingClientRect();
        if (b && Build.isElectronApp)
          G.Window.setContentSize(b.width, b.height);
        // Now that the window has been resized, remove the fitToContent
        // class so content will fill the window even if it shrinks.
        htmlElem.classList.remove('fitToContent');
      }
    }
    window.IPC.send('did-finish-render');
  }, 1);
}

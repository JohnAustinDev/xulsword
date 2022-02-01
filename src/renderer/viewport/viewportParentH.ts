/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-loop-func */
import React from 'react';
import C from '../../constant';
import {
  decodeOSISRef,
  escapeRE,
  firstIndexOfBookGroup,
  JSON_stringify,
  ofClass,
} from '../../common';
import { getElementInfo } from '../../libswordElemInfo';
import G from '../rg';
import { convertDotString } from '../rutil';
import { delayHandler } from '../libxul/xul';
import { TextCache } from './ztext';
import { textChange, aTextWheelScroll } from './zversekey';

import type { XulswordStatePref } from '../../type';
import type { XulswordState } from '../xulsword/xulsword';
import type { ViewportWinState } from './viewportWin';

export type MouseWheel = {
  atext: HTMLElement | null;
  count: 0;
  TO: number | undefined;
};

// The following are viewportWin notStatePref keys (values are not used)
export const vpWinNotStatePref = {
  history: [] as any[],
  historyIndex: 0,
  tabs: [] as (string[] | null)[],
  panels: [] as (string | null)[],
  ilModules: [] as (string | null)[],
  mtModules: [] as (string | null)[],
  flagScroll: [] as number[],
  isPinned: [true, true, true],
  noteBoxHeight: [] as number[],
  maximizeNoteBox: [] as number[],
  v11nmod: '',
  windowV11n: '',
  vpreset: 0,
};

export function updateVersification(component: React.Component) {
  const state = component.state as XulswordState | ViewportWinState;
  const { panels, v11nmod: currentMod, windowV11n } = state;
  const v11nmod = panels.find((m: string | null) => m && G.Tab[m].isVerseKey);
  const modV11n = v11nmod ? G.Tab[v11nmod].v11n : undefined;
  if (currentMod !== v11nmod || windowV11n !== modV11n) {
    component.setState({ v11nmod, windowV11n: modV11n });
  }
}

export function closeMenupopups(component: React.Component) {
  const { historyMenupopup } = component.state as any;
  let reset = 0;
  Array.from(document.getElementsByClassName('tabs')).forEach((t) => {
    if (t.classList.contains('open')) reset += 1;
  });
  if (reset || historyMenupopup) {
    component.setState((prevState: any) => {
      let { vpreset } = prevState;
      if (reset) vpreset += 1;
      const s: any = {};
      if (reset) s.vpreset = vpreset + 1;
      if (historyMenupopup) s.historyMenupopup = undefined;
      return s;
    });
  }
}

export default function handler(
  this: React.Component,
  es: React.SyntheticEvent<any>,
  noteboxResizing?: number[],
  maximize?: boolean
) {
  const statex = this.state as any;
  const { windowV11n } = statex;
  const state = this.state as XulswordState;
  const { panels } = state;
  const target = es.target as HTMLElement;
  const mcls = ofClass(['atext', 'tabs'], target);
  const atext = mcls && mcls.type === 'atext' ? mcls.element : null;
  const tabs = mcls && mcls.type === 'tabs' ? mcls.element : null;
  const index = Number(atext ? atext.dataset.index : tabs?.dataset.index);
  const isps = atext ? atext.dataset.ispinned : tabs?.dataset.ispinned;
  const isPinned = isps === 'true';
  const panel = panels[index];
  const type = panel ? G.Tab[panel].type : null;
  switch (es.type) {
    case 'click': {
      const e = es as React.MouseEvent;
      const targ = ofClass(
        [
          'text-pin',
          'text-win',
          'chaptermenucell',
          'heading-link',
          'bookgroupitem',
          'bookgroup',
          'open-chooser',
          'close-chooser',
          'notebox-maximizer',
          'reg-tab', // a regular tab
          'mts-tab', // the multi-tab main tab
          'mto-tab', // a multi-tab option tab
          'ilt-tab', // the interlinear tab
          'prevchaplink',
          'nextchaplink',
          'dict-key',
          'dt',
          'dtl',
          'fnlink',
          'crref',
          'origoption',
        ],
        target
      );
      if (targ === null) return;
      e.preventDefault();
      const elem = targ.element;
      const p = getElementInfo(elem);
      switch (targ.type) {
        case 'text-win': {
          const cols = atext?.dataset.columns;
          if (atext && cols !== undefined) {
            const columns = Number(cols);
            const notStatePref: Partial<XulswordState> = {};
            Object.entries(vpWinNotStatePref).forEach((entry) => {
              const name = entry[0] as keyof typeof vpWinNotStatePref;
              const nsp = notStatePref as any;
              nsp[name] = state[name];
            });
            const vpwPanels: any[] = [];
            const vpwTabs: any[] = [];
            notStatePref.panels?.forEach((pnl, i) => {
              const { tabs: tbs } = notStatePref;
              vpwTabs[i] = index === i && tbs && tbs[i] ? tbs[i] : undefined;
              vpwPanels[i] =
                index <= i && i < index + columns ? pnl : undefined;
            });
            notStatePref.panels = vpwPanels;
            notStatePref.tabs = vpwTabs;
            const b = atext.getBoundingClientRect();
            const options = {
              title: 'viewport',
              webPreferences: {
                additionalArguments: [
                  'viewportWin',
                  JSON_stringify(notStatePref),
                ],
              },
              openWithBounds: {
                x: Math.round(b.x),
                y: Math.round(b.y),
                width: Math.round(b.width),
                height: Math.round(b.height),
              },
            };
            G.openWindow('viewportWin', options);
          }
          break;
        }
        case 'text-pin': {
          if (atext && panel) {
            const { columns } = atext.dataset;
            this.setState((prevState: XulswordStatePref) => {
              const { isPinned: ip } = prevState;
              const newv = ip[index];
              for (let x = index; x < Number(columns) + index; x += 1) {
                ip[x] = !newv;
              }
              return { isPinned: ip };
            });
          }
          break;
        }
        case 'bookgroup': {
          const { bookgroup } = targ.element.dataset;
          const b = bookgroup ? firstIndexOfBookGroup(bookgroup) : null;
          if (b !== null) {
            this.setState({
              book: G.Books[b].sName,
              chapter: 1,
              verse: 1,
              selection: '',
            });
          }
          break;
        }
        case 'bookgroupitem': {
          const { book } = targ.element.dataset;
          if (book) {
            this.setState({
              book,
              chapter: 1,
              verse: 1,
              selection: '',
            });
          }
          break;
        }
        case 'chaptermenucell': {
          const { book, chapter } = targ.element.dataset;
          if (chapter) {
            this.setState({
              book,
              chapter: Number(chapter),
              verse: 1,
              selection: '',
            });
          }
          break;
        }
        case 'heading-link': {
          const {
            module: m,
            book: b,
            chapter: c,
            verse: v,
          } = targ.element.dataset;
          if (m) {
            const from = [b, c, v, v, G.Tab[m].v11n].join('.');
            const to = windowV11n ? convertDotString(from, windowV11n) : from;
            const [book, chapter, verse] = to.split('.');
            this.setState({
              book,
              chapter: Number(chapter),
              verse: Number(verse),
              selection: '',
            });
          }
          break;
        }
        case 'open-chooser': {
          this.setState({ showChooser: true });
          break;
        }
        case 'close-chooser': {
          this.setState({ showChooser: false });
          break;
        }
        case 'notebox-maximizer': {
          if (atext) {
            this.setState((prevState: XulswordStatePref) => {
              const { maximizeNoteBox, noteBoxHeight } = prevState;
              if (maximizeNoteBox[index] > 0) {
                noteBoxHeight[index] = maximizeNoteBox[index];
                maximizeNoteBox[index] = 0;
              } else {
                maximizeNoteBox[index] = noteBoxHeight[index];
                noteBoxHeight[index] =
                  atext.clientHeight -
                  C.TextHeaderHeight -
                  C.TextBBTopMargin -
                  5;
              }
              return { maximizeNoteBox, noteBoxHeight };
            });
          }
          break;
        }
        case 'reg-tab':
        case 'mts-tab':
        case 'mto-tab':
        case 'ilt-tab': {
          const m = elem.dataset.module;
          if (
            m &&
            m !== 'disabled' &&
            !elem.classList.contains('disabled') &&
            !state.isPinned[index]
          ) {
            if (targ.type === 'ilt-tab') {
              this.setState((prevState: XulswordStatePref) => {
                const { ilModules } = prevState;
                const s: Partial<XulswordStatePref> = {
                  ilModules: ilModules.slice(),
                };
                if (!s.ilModules) s.ilModules = [];
                s.ilModules[index] = ilModules[index] ? '' : m;
                return s;
              });
            } else {
              this.setState((prevState: XulswordStatePref) => {
                const { panels: pans, mtModules } = prevState;
                const s: Partial<XulswordStatePref> = {
                  panels: pans.slice(),
                };
                if (!s.panels) s.panels = [];
                s.panels[index] = m;
                if (targ.type === 'mto-tab' || targ.type === 'mts-tab') {
                  s.mtModules = mtModules.slice();
                  s.mtModules[index] = m;
                }
                return s;
              });
            }
          }
          break;
        }
        case 'prevchaplink': {
          if (atext && !isPinned) {
            this.setState((prevState: XulswordStatePref) => {
              return textChange(atext, false, prevState);
            });
          }
          break;
        }
        case 'nextchaplink': {
          if (atext && !isPinned) {
            this.setState((prevState: XulswordStatePref) => {
              return textChange(atext, true, prevState);
            });
          }
          break;
        }
        case 'dt':
        case 'dtl':
          if (
            p &&
            typeof p.osisref === 'string' &&
            elem.classList.contains('x-target_self')
          ) {
            this.setState((prevState: XulswordStatePref) => {
              const { keys } = prevState;
              const str = p.osisref as string;
              keys[index] = decodeOSISRef(str.replace(/^[^:]+:/, ''));
              return { keys };
            });
          }
          break;
        case 'dict-key': {
          const key = elem.innerText;
          if (atext && key) {
            this.setState((prevState: XulswordStatePref) => {
              const { keys } = prevState;
              keys[index] = key;
              return { keys };
            });
          }
          break;
        }
        case 'fnlink':
        case 'crref': {
          if (windowV11n && panel && p && p.mod && p.bk && p.ch && p.vs) {
            switch (type) {
              case C.BIBLE:
              case C.COMMENTARY: {
                const lvv = p.lv && targ.type === 'crref' ? p.lv : p.vs;
                const [bk, ch, vs, lv] = G.LibSword.convertLocation(
                  G.LibSword.getVerseSystem(p.mod),
                  [p.bk, p.ch, p.vs, lvv].join('.'),
                  windowV11n
                ).split('.');
                this.setState((prevState: XulswordStatePref) => {
                  let { flagScroll } = prevState;
                  flagScroll = flagScroll.map(() => C.VSCROLL.center);
                  return {
                    book: bk,
                    chapter: Number(ch),
                    verse: Number(vs),
                    flagScroll,
                    selection: [bk, ch, vs, lv].join('.'),
                  };
                });
                break;
              }
              default:
            }
          }
          break;
        }
        case 'origoption': {
          const value = elem.getAttribute('value');
          if (value) {
            const [, , , mod] = value.split('.');
            this.setState((prevState: XulswordStatePref) => {
              const { ilModules } = prevState;
              ilModules[index] = mod;
              return { ilModules };
            });
          }
          break;
        }
        default:
          throw Error(
            `Unhandled handleViewport click event on '${target.className}'`
          );
      }
      break;
    }

    case 'keydown': {
      const e = es as React.KeyboardEvent;
      const targ = ofClass(['dictkeyinput'], target);
      if (targ && panel) {
        e.stopPropagation();
        delayHandler.bind(this)((select: HTMLSelectElement, mod: string) => {
          const { value } = select;
          select.style.color = '';
          if (value && TextCache.dict.keyList) {
            const re = new RegExp(`(^|<nx>)(${escapeRE(value)}[^<]*)<nx>`, 'i');
            const firstMatch = `${TextCache.dict.keyList[mod].join(
              '<nx>'
            )}<nx>`.match(re);
            if (firstMatch) {
              this.setState((prevState: XulswordStatePref) => {
                const { keys } = prevState;
                [, , keys[index]] = firstMatch;
                return { keys };
              });
            } else if (e.key !== 'backspace') {
              G.Shell.beep();
              select.style.color = 'red';
            }
          }
        }, C.UI.Atext.dictKeyInputDelay)(targ.element, panel);
      }
      break;
    }

    case 'wheel': {
      const e = es as React.WheelEvent;
      const t = this as any;
      if (
        'mouseWheel' in t &&
        atext &&
        type !== C.DICTIONARY &&
        !ofClass(['nbc'], target)
      ) {
        const m = t.mouseWheel as MouseWheel;
        m.atext = atext;
        m.count += Math.round(e.deltaY / 80);
        if (m.TO) window.clearTimeout(m.TO);
        m.TO = window.setTimeout(() => {
          aTextWheelScroll(t);
        }, C.UI.Atext.wheelScrollDelay);
      }
      break;
    }

    // mousemove events passed from Atext's handler. This event means
    // the bb bar is being dragged while maximizeNoteBox > 0.
    case 'mousemove': {
      this.setState((prevState) => {
        const { maximizeNoteBox } = prevState as XulswordStatePref;
        maximizeNoteBox[index] = 0;
        return { maximizeNoteBox };
      });
      break;
    }

    // mouseup events passed from Atext's handler.
    case 'mouseup': {
      if (noteboxResizing) {
        this.setState((prevState: XulswordStatePref) => {
          const { maximizeNoteBox, noteBoxHeight } = prevState;
          const [initial, final] = noteboxResizing;
          if (maximize) maximizeNoteBox[index] = noteBoxHeight[index];
          noteBoxHeight[index] += initial - final;
          return { maximizeNoteBox, noteBoxHeight };
        });
      }
      break;
    }

    default:
      throw Error(`Unhandled handleViewport event type '${es.type}'`);
  }
}

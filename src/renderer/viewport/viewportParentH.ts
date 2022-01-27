/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-loop-func */
import React from 'react';
import C from '../../constant';
import {
  decodeOSISRef,
  escapeRE,
  firstIndexOfBookGroup,
  ofClass,
} from '../../common';
import { getElementInfo } from '../../libswordElemInfo';
import G from '../rg';
import { convertDotString } from '../rutil';
import { delayHandler } from '../libxul/xul';
import { TextCache } from './ztext';
import { textChange, aTextWheelScroll } from './zversekey';

import type { StateDefault } from '../../type';

export type MouseWheel = {
  atext: HTMLElement | null;
  count: 0;
  TO: number | undefined;
};

export function updateVersification(component: React.Component) {
  const {
    modules,
    numDisplayedWindows,
    v11nmod: currentMod,
    windowV11n,
  } = component.state as any;
  const v11nmod = modules.find((m: string, i: number) => {
    return i < numDisplayedWindows && m && G.Tab[m].isVerseKey;
  });
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
  const state = this.state as StateDefault;
  const { modules } = state;
  const target = es.target as HTMLElement;
  const mcls = ofClass(['atext', 'tabs'], target);
  const atext = mcls && mcls.type === 'atext' ? mcls.element : null;
  const tabs = mcls && mcls.type === 'tabs' ? mcls.element : null;
  const n = Number(atext ? atext.dataset.wnum : tabs?.dataset.wnum);
  const i = n - 1;
  const isPinned = atext?.classList.contains('pinned');
  const module = modules[i];
  const type = module ? G.Tab[module].type : null;
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
          if (atext) {
            const notStatePref: any = {
              isPinned: [true, true, true],
              numDisplayedWindows: Number(atext.dataset.columns),
              history: [],
              historyIndex: 0,
            };
            Object.entries(state).forEach((entry) => {
              const [name, value] = entry;
              if (!(name in notStatePref)) {
                if (Array.isArray(value)) {
                  const shvalue = value.slice();
                  for (let x = 1; x < n; x += 1) {
                    shvalue.push(shvalue.shift());
                  }
                  notStatePref[name] = shvalue;
                } else notStatePref[name] = value;
              }
            });
            const b = atext.getBoundingClientRect();
            const options = {
              title: 'viewport',
              webPreferences: {
                additionalArguments: [
                  'viewportWin',
                  JSON.stringify(notStatePref),
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
          if (atext && module) {
            const { columns } = atext.dataset;
            this.setState((prevState: StateDefault) => {
              const { isPinned: ip } = prevState;
              for (let x = i; x < Number(columns) + i; x += 1) {
                ip[x] = !ip[x];
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
            this.setState((prevState: StateDefault) => {
              const { maximizeNoteBox, noteBoxHeight } = prevState;
              if (maximizeNoteBox[i] > 0) {
                noteBoxHeight[i] = maximizeNoteBox[i];
                maximizeNoteBox[i] = 0;
              } else {
                maximizeNoteBox[i] = noteBoxHeight[i];
                noteBoxHeight[i] =
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
            !state.isPinned[i]
          ) {
            if (targ.type === 'ilt-tab') {
              this.setState((prevState: StateDefault) => {
                const { ilModules } = prevState;
                ilModules[i] = ilModules[i] ? '' : m;
                return { ilModules };
              });
            } else {
              this.setState((prevState: StateDefault) => {
                const { modules: mods, mtModules } = prevState;
                mods[i] = m;
                if (targ.type === 'mto-tab' || targ.type === 'mts-tab') {
                  mtModules[i] = m;
                }
                return {
                  modules: mods,
                  mtModules,
                };
              });
            }
          }
          break;
        }
        case 'prevchaplink': {
          if (atext && !isPinned) {
            this.setState((prevState: StateDefault) => {
              return textChange(atext, false, prevState);
            });
          }
          break;
        }
        case 'nextchaplink': {
          if (atext && !isPinned) {
            this.setState((prevState: StateDefault) => {
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
            this.setState((prevState: StateDefault) => {
              const { keys, flagScroll } = prevState;
              const str = p.osisref as string;
              keys[i] = decodeOSISRef(str.replace(/^[^:]+:/, ''));
              flagScroll[i] = C.SCROLLTYPECHAP;
              return { keys, flagScroll };
            });
          }
          break;
        case 'dict-key': {
          const key = elem.innerText;
          if (atext && key) {
            this.setState((prevState: StateDefault) => {
              const { keys } = prevState;
              keys[i] = key;
              return { keys };
            });
          }
          break;
        }
        case 'fnlink':
        case 'crref': {
          if (windowV11n && module && p && p.mod && p.bk && p.ch && p.vs) {
            switch (type) {
              case C.BIBLE:
              case C.COMMENTARY: {
                const lvv = p.lv && targ.type === 'crref' ? p.lv : p.vs;
                const [bk, ch, vs, lv] = G.LibSword.convertLocation(
                  G.LibSword.getVerseSystem(p.mod),
                  [p.bk, p.ch, p.vs, lvv].join('.'),
                  windowV11n
                ).split('.');
                this.setState((prevState: StateDefault) => {
                  let { flagScroll } = prevState;
                  flagScroll = flagScroll.map(() => C.SCROLLTYPECENTER);
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
            this.setState((prevState: StateDefault) => {
              const { ilModules } = prevState;
              ilModules[i] = mod;
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
      if (targ && module) {
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
              this.setState((prevState: StateDefault) => {
                const { keys } = prevState;
                [, , keys[i]] = firstMatch;
                return { keys };
              });
            } else if (e.key !== 'backspace') {
              G.Shell.beep();
              select.style.color = 'red';
            }
          }
        }, 1000)(targ.element, module);
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
        }, 250);
      }
      break;
    }

    // mousemove events passed from Atext's handler. This event means
    // the bb bar is being dragged while maximizeNoteBox > 0.
    case 'mousemove': {
      this.setState((prevState) => {
        const { maximizeNoteBox } = prevState as StateDefault;
        maximizeNoteBox[i] = 0;
        return { maximizeNoteBox };
      });
      break;
    }

    // mouseup events passed from Atext's handler.
    case 'mouseup': {
      if (noteboxResizing) {
        this.setState((prevState: StateDefault) => {
          const { maximizeNoteBox, noteBoxHeight } = prevState;
          const [initial, final] = noteboxResizing;
          if (maximize) maximizeNoteBox[i] = noteBoxHeight[i];
          noteBoxHeight[i] += initial - final;
          return { maximizeNoteBox, noteBoxHeight };
        });
      }
      break;
    }

    default:
      throw Error(`Unhandled handleViewport event type '${es.type}'`);
  }
}

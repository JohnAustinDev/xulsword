/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-loop-func */
import React from 'react';
import C from '../../constant';
import Cache from '../../cache';
import {
  decodeOSISRef,
  deepClone,
  escapeRE,
  JSON_stringify,
  ofClass,
} from '../../common';
import { getElementInfo } from '../../libswordElemInfo';
import G from '../rg';
import { getContextData, scrollIntoView, verseKey } from '../rutil';
import { delayHandler } from '../libxul/xul';
import { textChange } from './ztext';
import { aTextWheelScroll, chapterChange } from './zversekey';

import type { BookGroupType, XulswordStatePref } from '../../type';
import type Xulsword from '../xulsword/xulsword';
import type { XulswordState } from '../xulsword/xulsword';
import type ViewportWin from './viewportWin';
import type { ViewportWinState } from './viewportWin';
import type { AtextState } from './atext';

export const vpWinNotStatePref = {
  history: [] as any[],
  historyIndex: 0,
  tabs: [] as (string[] | null)[],
  panels: [] as (string | null)[],
  ilModules: [] as (string | null)[],
  mtModules: [] as (string | null)[],
  isPinned: [true, true, true],
  noteBoxHeight: [] as number[],
  maximizeNoteBox: [] as number[],
  vpreset: 0,
};

export function closeMenupopups(component: React.Component) {
  const state = component.state as XulswordState & ViewportWinState;
  let historyMenupopup: any;
  if ('historyMenupopup' in component.state) {
    historyMenupopup = state.historyMenupopup;
  }
  let reset = 0;
  Array.from(document.getElementsByClassName('tabs')).forEach((t) => {
    if (t.classList.contains('open')) reset += 1;
  });
  if (state && (reset || historyMenupopup)) {
    component.setState((prevState: typeof state) => {
      let { vpreset } = prevState;
      if (reset) vpreset += 1;
      const s: Partial<typeof state> = {};
      if (reset) s.vpreset = vpreset + 1;
      if (historyMenupopup) s.historyMenupopup = undefined;
      return s;
    });
  }
}

// Set viewportParent state or, if the target panel is pinned, the panel's
// Atext.pin state will be updated instead. This setState should be called
// any time the event handler modifies a C.PinProps state.
function setState(
  comp: Xulsword | ViewportWin,
  atext: HTMLElement,
  func: (prevState: typeof C.PinProps) => Partial<typeof C.PinProps> | null
) {
  const { index, ispinned } = atext.dataset;
  const panelIndex = Number(index);
  const isPinned = ispinned === 'true';
  if (!isPinned) {
    comp.setState((prevState: XulswordState | ViewportWinState) => {
      const { location, selection, flagScroll, panels, ilModules, keys } =
        prevState;
      const pinProps: typeof C.PinProps = {
        location,
        selection,
        flagScroll: flagScroll[panelIndex],
        module: panels[panelIndex],
        ilModule: ilModules[panelIndex],
        modkey: keys[panelIndex],
      };
      const newPinProps = func(pinProps);
      if (newPinProps) {
        const s: Partial<XulswordState> = {};
        Object.keys(C.PinProps).forEach((k: string) => {
          const key = k as keyof typeof C.PinProps;
          if (key in newPinProps) {
            switch (key) {
              case 'location':
              case 'selection': {
                s[key] = newPinProps[key];
                break;
              }
              case 'flagScroll': {
                const mysf = newPinProps.flagScroll;
                const fs: number[] = prevState.flagScroll.slice();
                if (mysf !== undefined) {
                  const ats = document.getElementsByClassName(`atext`);
                  Array.from(ats).forEach((at) => {
                    const a = at as HTMLElement;
                    const { index: inx, columns: c } = a.dataset;
                    if (mysf && inx && c) {
                      fs[Number(inx)] =
                        c && Number(c) > 1 ? mysf : C.VSCROLL.centerAlways;
                    }
                  });
                }
                s.flagScroll = fs;
                break;
              }
              case 'module':
              case 'ilModule':
              case 'modkey': {
                const map = {
                  module: 'panels',
                  ilModule: 'ilModules',
                  modkey: 'keys',
                } as const;
                const ps = deepClone(prevState[map[key]]);
                ps[panelIndex] = newPinProps[key];
                s[map[key]] = ps;
                break;
              }
              default:
                throw Error(`Unhandled PinProp '${key}'`);
            }
          }
        });
        return Object.keys(s).length ? s : null;
      }
      return null;
    });
  } else {
    const atextcomp = comp.atextRefs[panelIndex];
    if (atextcomp?.current) {
      atextcomp.current.setState((prevState: AtextState) => {
        if (prevState.pin) {
          const newPinProps = func(prevState.pin);
          if (newPinProps && prevState.pin) {
            const s: Partial<AtextState> = {
              pin: {
                ...prevState.pin,
                ...newPinProps,
              },
            };
            return s;
          }
        }
        return null;
      });
    }
  }
}

export default function handler(
  this: Xulsword | ViewportWin,
  es: React.SyntheticEvent<any>,
  noteboxResizing?: number[],
  maximize?: boolean
) {
  const state = this.state as XulswordState | ViewportWinState;
  const { location } = state;
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
          'gfn',
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
            const b = atext.getBoundingClientRect();
            // Save new window's XulswordState
            const xulswordState: Partial<XulswordState> = {};
            Object.entries(vpWinNotStatePref).forEach((entry) => {
              const name = entry[0] as keyof typeof vpWinNotStatePref;
              const nsp = xulswordState as any;
              nsp[name] = state[name];
            });
            // Set new window's unused tabs & panels to undefined
            const vpwPanels: any[] = [];
            const vpwTabs: any[] = [];
            xulswordState.panels?.forEach((pnl, i) => {
              const { tabs: tbs } = xulswordState;
              vpwTabs[i] = index === i && tbs && tbs[i] ? tbs[i] : undefined;
              vpwPanels[i] =
                index <= i && i < index + Number(cols) ? pnl : undefined;
            });
            xulswordState.panels = vpwPanels;
            xulswordState.tabs = vpwTabs;
            // Save new window's Atext states
            const atextStates: { [i: string]: Partial<AtextState> } = {};
            if ('atextRefs' in this) {
              vpwPanels.forEach((pnl, i) => {
                if (pnl) {
                  const ref = this.atextRefs[i];
                  if (ref?.current) {
                    const ats = ref.current.state as AtextState;
                    const s: Partial<AtextState> = {
                      pin: ats.pin,
                      versePerLine: ats.versePerLine,
                    };
                    atextStates[`atext${i}State`] = s;
                  }
                }
              });
            }
            const options = {
              title: 'viewport',
              webPreferences: {
                additionalArguments: [
                  JSON_stringify({
                    xulswordState,
                    ...atextStates,
                  }),
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
          const bg = bookgroup as BookGroupType;
          const bk = bookgroup ? G.Book[C.SupportedBooks[bg][0]] : null;
          if (bk) {
            this.setState({
              location: {
                book: bk.code,
                chapter: 1,
                verse: 1,
                v11n: location?.v11n || 'KJV',
              },
              selection: null,
            });
          }
          break;
        }
        case 'bookgroupitem': {
          const { book } = targ.element.dataset;
          if (book && !targ.element.classList.contains('disabled')) {
            this.setState({
              location: {
                book,
                chapter: 1,
                verse: 1,
                v11n: location?.v11n || 'KJV',
              },
              selection: null,
            });
          }
          break;
        }
        case 'chaptermenucell': {
          const { book, chapter } = targ.element.dataset;
          if (book && chapter) {
            const newloc = chapterChange({
              book,
              chapter: Number(chapter),
              v11n: location?.v11n || 'KJV',
            });
            if (newloc) {
              this.setState({
                location: newloc,
                selection: null,
              });
            }
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
          const v11n = (m && G.Tab[m].v11n) || 'KJV';
          if (location && m && b && v) {
            const newloc = verseKey(
              { book: b, chapter: Number(c), verse: Number(v), v11n },
              location.v11n
            ).location();
            this.setState({
              location: newloc,
              selection: null,
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
                const { columns: clsx } = atext.dataset;
                const columns = Number(clsx);
                let stopHeight = atext.clientHeight - C.UI.Atext.prevNextHeight;
                if (columns === 1) stopHeight -= C.UI.Atext.bbTopMargin;
                noteBoxHeight[index] = stopHeight;
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
        case 'prevchaplink':
        case 'nextchaplink': {
          if (atext) {
            setState(this, atext, (prevState: typeof C.PinProps) => {
              return textChange(atext, targ.type === 'nextchaplink', prevState);
            });
          }
          break;
        }
        case 'dt':
        case 'dtl':
          if (
            p &&
            typeof p.osisref === 'string' &&
            elem.classList.contains('x-target_self') &&
            atext
          ) {
            setState(this, atext, (prevState: typeof C.PinProps) => {
              let { modkey } = prevState;
              const str = p.osisref as string;
              modkey = decodeOSISRef(str.replace(/^[^:]+:/, ''));
              return { modkey };
            });
          }
          break;
        case 'dict-key': {
          const key = elem.innerText;
          if (atext && key) {
            setState(this, atext, () => {
              return { modkey: key };
            });
          }
          break;
        }
        case 'gfn': {
          if (p && p.title) {
            const parent = ofClass(['npopup', 'atext'], target);
            if (parent) {
              const gfns = parent.element.getElementsByClassName('gfn');
              Array.from(gfns).forEach((gfn: any) => {
                if (gfn !== elem && gfn.dataset.title === p.title)
                  scrollIntoView(gfn, parent.element);
              });
            }
          }
          break;
        }
        case 'fnlink':
        case 'crref': {
          if (atext && location && p?.bk && p.ch) {
            switch (type) {
              case C.BIBLE:
              case C.COMMENTARY: {
                const newloc = verseKey(
                  {
                    book: p.bk,
                    chapter: Number(p.ch),
                    verse: p.vs,
                    lastverse: p.lv,
                    v11n: (p.mod && G.Tab[p.mod].v11n) || 'KJV',
                  },
                  location.v11n
                ).location();
                setState(this, atext, () => {
                  const s: Partial<typeof C.PinProps> = {
                    location: newloc,
                    selection: newloc,
                    flagScroll: C.VSCROLL.center,
                  };
                  return s;
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
          if (value && atext) {
            const [, , , mod] = value.split('.');
            setState(this, atext, () => {
              return { ilModule: mod };
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
      if (targ && panel && atext) {
        e.stopPropagation();
        delayHandler.bind(this)(
          (select: HTMLSelectElement, mod: string) => {
            const { value } = select;
            select.style.color = '';
            if (value && Cache.has('keylist', mod)) {
              const re = new RegExp(
                `(^|<nx>)(${escapeRE(value)}[^<]*)<nx>`,
                'i'
              );
              const firstMatch = `${Cache.read('keylist', mod).join(
                '<nx>'
              )}<nx>`.match(re);
              if (firstMatch) {
                setState(this, atext, () => {
                  return { modkey: firstMatch[2] };
                });
              } else if (e.key !== 'backspace') {
                G.Shell.beep();
                select.style.color = 'red';
              }
            }
          },
          C.UI.Atext.dictKeyInputDelay,
          'dictkeydownTO'
        )(targ.element, panel);
      }
      break;
    }

    case 'wheel': {
      const e = es as React.WheelEvent;
      if (
        !isPinned &&
        atext &&
        type !== C.DICTIONARY &&
        !ofClass(['nbc'], target)
      ) {
        aTextWheelScroll(e, atext, this);
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
      if (noteboxResizing && atext) {
        this.setState((prevState: XulswordStatePref) => {
          const { maximizeNoteBox, noteBoxHeight } = prevState;
          const [initial, final] = noteboxResizing;
          if (maximize === true) {
            maximizeNoteBox[index] = noteBoxHeight[index];
            const { columns: clsx } = atext.dataset;
            const columns = Number(clsx);
            let stopHeight = atext.clientHeight - C.UI.Atext.prevNextHeight;
            if (columns === 1) stopHeight -= C.UI.Atext.bbTopMargin;
            noteBoxHeight[index] = stopHeight;
          } else if (maximize === false) {
            noteBoxHeight[index] = C.UI.Atext.bbBottomMargin;
          } else {
            noteBoxHeight[index] += initial - final;
          }
          return { maximizeNoteBox, noteBoxHeight };
        });
      }
      break;
    }

    case 'contextmenu': {
      G.Data.write(getContextData(target), 'contextData');
      break;
    }

    default:
      throw Error(`Unhandled handleViewport event type '${es.type}'`);
  }
}

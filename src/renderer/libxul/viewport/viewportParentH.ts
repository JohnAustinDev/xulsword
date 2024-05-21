/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-loop-func */
import React from 'react';
import C from '../../../constant.ts';
import S from '../../../defaultPrefs.ts';
import Cache from '../../../cache.ts';
import { clone, escapeRE, ofClass } from '../../../common.ts';
import { getElementData, verseKey } from '../../htmlData.ts';
import G from '../../rg.ts';
import { scrollIntoView, windowArguments } from '../../rutil.ts';
import { delayHandler } from '../xul.tsx';
import { textChange } from './ztext.ts';
import { aTextWheelScroll, chapterChange } from './zversekey.ts';

import type {
  BookGroupType,
  PinPropsType,
  V11nType,
  OSISBookType,
} from '../../../type.ts';
import type Xulsword from '../../xulswordWin/xulsword.tsx';
import type { XulswordState } from '../../xulswordWin/xulsword.tsx';
import type { DragSizerVal } from '../dragsizer.tsx';
import type { AtextStateType } from './atext.tsx';
import type ViewportWin from '../../viewportWin/viewportWin.tsx';
import type { ViewportWinState } from '../../viewportWin/viewportWin.tsx';

const WindowDescriptor = windowArguments();

// Important: These SP.xulsword properties become independent
// window properties for windows other than the xulsword window.
// So they are xulsword state prefs, but become just local state
// for other windows (they are however persisted as window prefs).
export const vpWindowState = [
  'tabs',
  'panels',
  'keys',
  'history',
  'historyIndex',
  'scroll',
  'place',
  'ilModules',
  'mtModules',
  'isPinned',
  'noteBoxHeight',
  'maximizeNoteBox',
] as const;

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

export function bbDragEnd(
  this: Xulsword | ViewportWin,
  e: React.MouseEvent,
  value: DragSizerVal
) {
  const target = e.target as HTMLElement;
  const atext = ofClass(['atext'], target)?.element;
  const index = Number(atext && atext.dataset.index);
  if (atext && !Number.isNaN(Number(index))) {
    let { noteBoxHeight, maximizeNoteBox } = this
      .state as typeof S.prefs.xulsword;
    noteBoxHeight = noteBoxHeight.slice();
    maximizeNoteBox = maximizeNoteBox.slice();
    maximizeNoteBox[index] = value.isMinMax === true;
    noteBoxHeight[index] = value.sizerPos;
    this.setState({
      noteBoxHeight,
      maximizeNoteBox,
    } as typeof S.prefs.xulsword);
  }
}

// Set viewportParent state or, if the target panel is pinned, the panel's
// Atext.pin state will be updated instead. This setState should be called
// any time the event handler modifies a C.PinProps state.
function setState(
  comp: Xulsword | ViewportWin,
  atext: HTMLElement,
  func: (prevState: PinPropsType) => Partial<PinPropsType> | null
) {
  const { index, ispinned } = atext.dataset;
  const panelIndex = Number(index);
  const isPinned = ispinned === 'true';
  if (!isPinned) {
    comp.setState((prevState: XulswordState | ViewportWinState) => {
      const {
        location,
        selection,
        scroll,
        show,
        place,
        panels,
        ilModules,
        keys,
      } = prevState;
      const pinProps: PinPropsType = {
        location,
        selection,
        scroll,
        show,
        place,
        module: panels[panelIndex] || '',
        ilModule: ilModules[panelIndex] || '',
        modkey: keys[panelIndex] || '',
      };
      const newPinProps = func(pinProps);
      if (newPinProps) {
        const s: Partial<XulswordState> = {};
        C.PinProps.forEach((key) => {
          if (key in newPinProps) {
            switch (key) {
              case 'location':
              case 'selection':
              case 'scroll':
              case 'show':
              case 'place': {
                s[key] = newPinProps[key] as any;
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
                const ps = clone(prevState[map[key]]);
                ps[panelIndex] = newPinProps[key] || null;
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
      atextcomp.current.setState((prevState: AtextStateType) => {
        if (prevState.pin) {
          const newPinProps = func(prevState.pin);
          if (newPinProps && prevState.pin) {
            const s: Partial<AtextStateType> = {
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
  es: React.SyntheticEvent<any>
) {
  const { renderPromise } = this;
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
          'dictkey',
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
      const p = getElementData(elem);
      switch (targ.type) {
        case 'text-win': {
          const cols = atext?.dataset.columns;
          if (window.processR.platform !== 'browser'
             && atext && cols !== undefined) {
            // Save new window's XulswordState
            const xulswordState: Partial<XulswordState> = {};
            vpWindowState.forEach((name) => {
              const nsp = xulswordState as any;
              nsp[name] = state[name];
            });
            // Set new window's unused tabs & panels to null
            const vpwPanels: any[] = [];
            const vpwTabs: any[] = [];
            xulswordState.panels?.forEach((pnl, i) => {
              const { tabs: tbs } = xulswordState;
              vpwTabs[i] = index === i && tbs && tbs[i] ? tbs[i] : null;
              vpwPanels[i] =
                index <= i && i < index + Number(cols) ? pnl : null;
            });
            xulswordState.panels = vpwPanels;
            xulswordState.tabs = vpwTabs;
            // Save new window's Atext states
            const atextStates: { [i: string]: Partial<AtextStateType> } = {};
            if ('atextRefs' in this) {
              vpwPanels.forEach((pnl, i) => {
                if (pnl) {
                  const ref = this.atextRefs[i];
                  if (ref?.current) {
                    const ats = ref.current.state as AtextStateType;
                    const s: Partial<AtextStateType> = {
                      pin: ats.pin,
                      versePerLine: ats.versePerLine,
                    };
                    atextStates[`atext${i}State`] = s;
                  }
                }
              });
            }
            // Calculate the content size ViewportWin should be created with:
            const atextb = atext.getBoundingClientRect();
            const textareab = document
              .getElementsByClassName('textarea')[0]
              ?.getBoundingClientRect();
            const vpPadding = 15; // left padding of ViewportWin (assumes same as right and bottom)
            const vpPaddingTop = 10; // top padding of ViewportWin
            G.Window.open({
              type: 'viewportWin',
              className: 'skin',
              allowMultiple: true,
              saveIfAppClosed: true,
              openWithBounds: {
                withinWindowID: WindowDescriptor.id,
                x: Math.round(atextb.x - vpPadding),
                y: Math.round(textareab.y - vpPaddingTop),
                width: Math.round(atextb.width + 2 * vpPadding),
                height: Math.round(textareab.height + vpPaddingTop + vpPadding),
              },
              additionalArguments: {
                xulswordState,
                ...atextStates,
              },
              options: { title: 'viewport' },
            });
          }
          break;
        }
        case 'text-pin': {
          if (atext && panel) {
            const { columns } = atext.dataset;
            this.setState((prevState: typeof S.prefs.xulsword) => {
              const { isPinned: ipx } = prevState;
              const ip = ipx.slice();
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
          const { bookgroup, v11n } = targ.element.dataset;
          const bg = bookgroup as BookGroupType;
          const bk = bookgroup ? G.Book[C.SupportedBooks[bg][0]] : null;
          if (bk) {
            this.setState({
              location: {
                book: bk.code,
                chapter: 1,
                verse: 1,
                v11n: v11n as V11nType,
              },
              selection: null,
            });
          }
          break;
        }
        case 'bookgroupitem': {
          const { book, v11n } = targ.element.dataset;
          if (book && !targ.element.classList.contains('disabled')) {
            this.setState({
              location: {
                book,
                chapter: 1,
                verse: 1,
                v11n: v11n as V11nType,
              },
              selection: null,
            });
          }
          break;
        }
        case 'chaptermenucell': {
          const { book, chapter, v11n } = targ.element.dataset;
          if (book && chapter) {
            const newloc = chapterChange(
              {
                book: book as OSISBookType,
                chapter: Number(chapter),
                v11n: v11n as V11nType,
              },
              0
            );
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
          const v11n = (m && G.Tab[m].v11n) || null;
          if (location && m && b && v && v11n) {
            const newloc = verseKey(
              {
                book: b as OSISBookType,
                chapter: Number(c),
                verse: Number(v),
                v11n,
              },
              location.v11n,
              undefined,
              renderPromise
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
            this.setState((prevState: typeof S.prefs.xulsword) => {
              let { maximizeNoteBox, noteBoxHeight } = prevState;
              maximizeNoteBox = clone(maximizeNoteBox);
              noteBoxHeight = clone(noteBoxHeight);
              maximizeNoteBox[index] = !maximizeNoteBox[index];
              if (
                !maximizeNoteBox[index] &&
                noteBoxHeight[index] > C.UI.Atext.initialNoteboxHeight
              ) {
                noteBoxHeight[index] = C.UI.Atext.initialNoteboxHeight;
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
              this.setState((prevState: typeof S.prefs.xulsword) => {
                const { ilModules } = prevState;
                const s: Partial<typeof S.prefs.xulsword> = {
                  ilModules: ilModules.slice(),
                };
                if (!s.ilModules) s.ilModules = [];
                s.ilModules[index] = ilModules[index] ? '' : m;
                return s;
              });
            } else {
              this.setState((prevState: typeof S.prefs.xulsword) => {
                const { panels: pans, mtModules } = prevState;
                const s: Partial<typeof S.prefs.xulsword> = {
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
            setState(this, atext, (prevState: PinPropsType) => {
              return textChange(atext, targ.type === 'nextchaplink', prevState, renderPromise);
            });
          }
          break;
        }
        case 'dt':
        case 'dtl':
          if (
            p &&
            p.locationGB &&
            elem.classList.contains('x-target_self') &&
            atext
          ) {
            const modkey = p.locationGB.key;
            setState(this, atext, () => {
              return { modkey };
            });
          }
          break;
        case 'dictkey': {
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
          if (p) {
            const { context, location: l } = p;
            if (context && l) {
              const { book, chapter, verse, lastverse, v11n } = l;
              const loc = {
                book,
                chapter,
                verse: verse || 1,
                lastverse: lastverse || 1,
                v11n,
              };
              G.Commands.goToLocationVK(loc, loc);
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
      if (!isPinned && atext && type && !ofClass(['nbc'], target)) {
        if ([C.BIBLE, C.COMMENTARY].includes(type)) {
          aTextWheelScroll(e, atext, this);
        } else if (type === C.GENBOOK) {
          const sb = atext.getElementsByClassName('sb');
          if (sb.length) {
            sb[0].scrollLeft += e.deltaY;
          }
        }
      }
      break;
    }

    default:
      throw Error(`Unhandled handleViewport event type '${es.type}'`);
  }
}

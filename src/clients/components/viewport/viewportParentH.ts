import type React from 'react';
import VerseKey from '../../../verseKey.ts';
import { goToLocationVK } from '../../../commands.ts';
import C from '../../../constant.ts';
import type S from '../../../defaultPrefs.ts';
import { clone, escapeRE, ofClass } from '../../../common.ts';
import { getElementData } from '../../htmlData.ts';
import { G, GI } from '../../G.ts';
import {
  doUntilDone,
  safeScrollIntoView,
  notMouse,
  windowArguments,
} from '../../common.ts';
import { delayHandler } from '../libxul/xul.tsx';
import { textChange } from '../atext/ztext.ts';
import { aTextWheelScroll, chapterChange } from '../atext/zversekey.ts';

import type {
  BookGroupType,
  PinPropsType,
  V11nType,
  OSISBookType,
  GType,
} from '../../../type.ts';
import type Xulsword from '../xulsword/xulsword.tsx';
import type { XulswordState } from '../xulsword/xulsword.tsx';
import type { DragSizerVal } from '../libxul/dragsizer.tsx';
import type { AtextStateType } from '../atext/atext.tsx';
import type ViewportWin from '../../app/viewportWin/viewportWin.tsx';
import type { ViewportWinState } from '../../app/viewportWin/viewportWin.tsx';

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
    ({ historyMenupopup } = state);
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
  value: DragSizerVal,
) {
  const target = e.target as HTMLElement;
  const atext = ofClass(['atext'], target)?.element;
  const index = Number(atext?.dataset.index);
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
  func: (prevState: PinPropsType) => Partial<PinPropsType> | null,
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
                throw Error(`Unhandled PinProp '${key as string}'`);
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
  es: React.SyntheticEvent<any>,
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
          'towindow',
          'chaptermenucell',
          'heading-link',
          'bookgroupitem',
          'bookgroup',
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
        target,
      );
      if (targ === null) return;
      e.preventDefault();
      const elem = targ.element;
      const p = getElementData(elem);
      notMouse(e);
      switch (targ.type) {
        case 'towindow': {
          const cols = atext?.dataset.columns;
          if (Build.isElectronApp && atext && cols !== undefined) {
            const GT = G as GType;
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
              vpwTabs[i] = index === i && tbs?.[i] ? tbs[i] : null;
              vpwPanels[i] =
                index <= i && i < index + Number(cols) ? pnl : null;
            });
            xulswordState.panels = vpwPanels;
            xulswordState.tabs = vpwTabs;
            // Save new window's Atext states
            const atextStates: Record<string, Partial<AtextStateType>> = {};
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
            xulswordState.historyMenupopup = undefined;
            const xst = xulswordState as Omit<
              typeof xulswordState,
              'historyMenupopup'
            >;
            GT.Window.open({
              type: 'viewportWin',
              allowMultiple: true,
              saveIfAppClosed: true,
              openWithBounds: {
                withinWindowID: windowArguments().id,
                x: Math.round(atextb.x - vpPadding),
                y: Math.round(textareab.y - vpPaddingTop),
                width: Math.round(atextb.width + 2 * vpPadding),
                height: Math.round(textareab.height + vpPaddingTop + vpPadding),
              },
              additionalArguments: {
                xulswordState: xst,
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
          const { Book } = G;
          const bg = bookgroup as BookGroupType;
          const bk = bookgroup ? Book[C.SupportedBooks[bg][0]] : null;
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
          doUntilDone((renderPromise2) => {
            if (book && chapter) {
              const newloc = chapterChange(
                {
                  book: book as OSISBookType,
                  chapter: Number(chapter),
                  v11n: v11n as V11nType,
                },
                0,
                renderPromise2,
              );
              if (newloc && !renderPromise2?.waiting()) {
                this.setState({
                  location: newloc,
                  selection: null,
                });
              }
            }
          });
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
          doUntilDone((renderPromise2) => {
            if (location && m && b && v && v11n) {
              const newloc = new VerseKey(
                {
                  book: b as OSISBookType,
                  chapter: Number(c),
                  verse: Number(v),
                  v11n,
                },
                renderPromise2,
              ).location(location.v11n);
              if (!this.renderPromise.waiting())
                this.setState({
                  location: newloc,
                  selection: null,
                });
            }
          });
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
          doUntilDone((renderPromise2) => {
            if (atext && !renderPromise2?.waiting()) {
              setState(this, atext, (prevState: PinPropsType) => {
                return textChange(
                  atext,
                  targ.type === 'nextchaplink',
                  renderPromise2,
                  prevState,
                );
              });
            }
          });
          break;
        }
        case 'dt':
        case 'dtl':
          if (
            p?.locationGB &&
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
          if (p?.title) {
            const parent = ofClass(['npopup', 'atext'], target);
            if (parent) {
              const gfns = parent.element.getElementsByClassName(
                'gfn',
              ) as HTMLCollectionOf<HTMLElement>;
              Array.from(gfns).forEach((gfn) => {
                if (gfn !== elem && gfn.dataset.title === p.title)
                  safeScrollIntoView(gfn, parent.element, undefined, 30);
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
              void goToLocationVK(loc, loc);
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
            `Unhandled handleViewport click event on '${target.className}'`,
          );
      }
      break;
    }

    case 'keydown': {
      const e = es as React.KeyboardEvent;
      const targ = ofClass(['dictkeyinput'], target);
      if (targ && targ.element && panel && atext) {
        e.stopPropagation();
        handleDictKeyInput(
          this,
          panel,
          atext,
          targ.element as HTMLInputElement,
          e.key,
          e.key === 'Enter' ? 0 : C.UI.Atext.dictKeyInputDelay,
        );
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

function handleDictKeyInput(
  xthis: Xulsword | ViewportWin,
  module: string,
  atext: HTMLElement,
  targelem: HTMLInputElement,
  key: string,
  delay = 0,
) {
  doUntilDone((renderPromise2) => {
    const keylist = GI.getAllDictionaryKeyList([], renderPromise2, module);
    delayHandler(
      xthis,
      (select: HTMLInputElement) => {
        if (!renderPromise2?.waiting()) {
          const { value } = select;
          select.style.color = '';
          if (value) {
            const re = new RegExp(`(^|<nx>)(${escapeRE(value)}[^<]*)<nx>`, 'i');
            const firstMatch = `${keylist.join('<nx>')}<nx>`.match(re);
            if (firstMatch) {
              setState(xthis, atext, () => {
                return { modkey: firstMatch[2] };
              });
            } else if (key !== 'backspace') {
              // if (Build.isElectronApp) (G as GType).Shell.beep();
              select.style.color = 'red';
            }
          }
        }
      },
      [targelem],
      delay,
      'dictkeydownTO',
    );
  });
}

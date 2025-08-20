import type React from 'react';
import Subscription from '../../../subscription.ts';
import { clone, ofClass, randomID } from '../../../common.ts';
import C from '../../../constant.ts';
import type S from '../../../defaultPrefs.ts';
import { G } from '../../G.ts';
import Commands from '../../commands.ts';
import { findElementData, updateDataAttribute } from '../../htmlData.ts';
import {
  rootRenderPromise,
  scrollIntoView,
  windowArguments,
} from '../../common.tsx';
import { delayHandler } from '../libxul/xul.tsx';

import type { PlaceType, SearchType, ShowType } from '../../../type.ts';
import type { RenderPromiseComponent } from '../../renderPromise.ts';
import type { HTMLData } from '../../htmlData.ts';
import type Atext from '../atext/atext.tsx';

let WheelScrolling = false;

export type PopupParent = RenderPromiseComponent & {
  state: React.ComponentState;
  props: React.ComponentProps<any>;
  setState: React.Component['setState'];
  popupDelayTO?: NodeJS.Timeout | undefined | null;
  popupUnblockTO?: NodeJS.Timeout | undefined;
  popupHandler: typeof popupHandler;
  popupParentHandler?: typeof popupParentHandler;
  popupUpClickClose?: typeof popupUpClickClose; // Far WebApp only
};

export const PopupParentInitState = {
  elemdata: [] as HTMLData[] | null, // popup target element data
  gap: 0 as number, // gap between target element and top of popup
  popupHold: false as boolean, // hold popup open
  popupParent: null as HTMLElement | null, // popup location
  popupReset: 0 as number, // increment this to re-mount popup
};

export type PopupParentState = typeof PopupParentInitState;

export type ViewportPopupProps = {
  place: PlaceType;
  show: ShowType;
  isPinned: boolean[];
  atextRefs: Array<React.RefObject<Atext>>;
};

export function popupParentHandler(
  this: PopupParent,
  es: React.SyntheticEvent,
  module?: string,
) {
  switch (es.type) {
    case 'mouseover': {
      const ppar = ofClass(['npopup'], es.target);
      const parent = ppar?.element;
      // Only mouseovers outside of a popup which are not 'x-target_self' are handled here.
      if (parent) return;
      let targ = ofClass(
        [
          'cr',
          'fn',
          'un',
          'sn',
          'sr',
          'dt',
          'dtl',
          'aboutlink',
          'introlink',
          'searchterm',
        ],
        es.target,
        'self',
      );
      // searchterm will be a child span of sn and the sn parent is needed, not the searchterm.
      if (targ?.type === 'searchterm') {
        targ = ofClass(['sn'], targ.element);
      }
      if (targ === null) return;
      if (targ.element.classList.contains('x-target_self')) return;
      const state = this.state as PopupParentState;
      const props = this.props as Partial<ViewportPopupProps>;
      const target = es.target as HTMLElement;
      const type = module ? G.Tab[module].type : null;
      const { place: pl, show: sh, atextRefs, isPinned } = props;
      const atext = ofClass(['atext'], target);
      const index = Number(atext?.element?.dataset.index) || 0;
      const atr = ((atext && atextRefs?.[index].current) ||
        null) as PopupParent | null;
      const place: PlaceType | undefined =
        (atr && isPinned && isPinned[index] && atr.state.pin.place) || pl;
      const show: ShowType | undefined =
        (atr && isPinned && isPinned[index] && atr.state.pin.show) || sh;
      const e = es as React.MouseEvent;
      const { popupDelayTO, renderPromise } = this;
      const { popupParent } = state;
      if (popupDelayTO) clearTimeout(popupDelayTO);
      e.preventDefault();
      const elem = targ.element;
      let openPopup = false;
      let gap = C.UI.Popup.openGap;
      const data = findElementData(elem);
      switch (targ.type) {
        case 'cr':
          if (!place || place.crossrefs === 'popup') openPopup = true;
          break;
        case 'fn':
          // genbk fn are already embedded in the text
          if ((!place || place.footnotes === 'popup') && type !== C.GENBOOK) {
            openPopup = true;
          }
          break;
        case 'un':
          if (
            !place ||
            place.usernotes === 'popup' ||
            (module && !G.Tab[module].isVerseKey)
          ) {
            openPopup = true;
          }
          break;
        case 'sn':
          if (!show || show.strongs) {
            openPopup = true;
            gap = C.UI.Popup.strongsOpenGap;
          }
          break;
        case 'sr':
        case 'dt':
        case 'dtl':
        case 'aboutlink':
        case 'introlink':
          openPopup = true;
          break;
        default:
      }
      // The delayHandler must be used to delay getPopupHTML, or else web apps
      // will make dozens of unnecessary server calls each time the user simply
      // moves the cursor around over a strong's tagged text such as KJV.
      if (data && openPopup && !popupParent) {
        delayHandler(
          this,
          (el: HTMLElement, dt: HTMLData, gp: number) => {
            updateDataAttribute(el, dt);
            const s: Partial<PopupParentState> = {
              elemdata: [dt],
              gap: gp,
              popupParent: el,
            };
            this.setState(s);
          },
          [elem, data, gap],
          targ.type === 'sn'
            ? C.UI.Popup.strongsOpenDelay
            : C.UI.Popup.openDelay,
          'popupDelayTO',
        );
      }
      break;
    }

    case 'mouseout': {
      if (this.popupDelayTO) clearTimeout(this.popupDelayTO);
      break;
    }

    case 'wheel': {
      if ('popupDelayTO' in this) {
        // Block popup for a time when mouse-wheel is turned, and then
        // wait until the mouse moves again to re-enable the popup.
        if (this.popupDelayTO) clearTimeout(this.popupDelayTO);
        this.popupDelayTO = null; // blocks the popup
        WheelScrolling = true;
        delayHandler(
          this,
          () => (WheelScrolling = false),
          [],
          C.UI.Popup.wheelDeadTime,
          'popupUnblockTO',
        );
      }
      break;
    }

    case 'mousemove': {
      if (
        'popupDelayTO' in this &&
        this.popupDelayTO === null &&
        !WheelScrolling
      ) {
        this.popupDelayTO = undefined; // unblocks the popup
      }
      break;
    }

    default:
      throw Error(`Unhandled popupParentH event type: '${es.type}'`);
  }
}

export function popupHandler(this: PopupParent, es: React.SyntheticEvent) {
  switch (es.type) {
    case 'click': {
      const e = es as React.MouseEvent;
      const targ = ofClass(
        [
          'fn',
          'sn',
          'cr',
          'sr',
          'dt',
          'dtl',
          'gfn',
          'crref',
          'popupCloseLink',
          'popupBackLink',
          'towindow',
          'pupselect',
          'snbut',
          'npopup',
          'requiremod',
        ],
        es.target,
      );
      if (!targ) return;
      const state = this.state as PopupParentState;
      const { popupParent } = state;
      const parent = popupParent || document.getElementById('root');
      // Require popup or window parent but don't search beyond npopup when testing type
      if (!parent || targ.type === 'npopup') return;
      e.preventDefault();
      e.stopPropagation();
      const elem = targ.element;
      const data = findElementData(elem);
      const popupY = parent.getBoundingClientRect().y;
      switch (targ.type) {
        case 'fn':
        case 'sn':
        case 'cr':
        case 'sr':
        case 'dt':
        case 'dtl': {
          if (data && !targ.element.classList.contains('empty')) {
            this.setState((prevState: PopupParentState) => {
              let { elemdata } = prevState;
              if (elemdata === null) elemdata = [];
              else elemdata = clone(elemdata);
              // sn links within sn popups should keep their original context
              if (elemdata.at(-1)?.type === 'sn' && data.type === 'sn') {
                data.context = elemdata.at(-1)?.context;
              }
              elemdata.push(data);
              // set the gap so as to position popup under the mouse
              const gap = Math.round(e.clientY - popupY - 40);
              const s: Partial<PopupParentState> = {
                elemdata,
                gap,
              };
              return s;
            });
          }
          break;
        }
        case 'gfn': {
          if (data) {
            const gfns = parent.getElementsByClassName('gfn');
            Array.from(gfns).forEach((gfn) => {
              const gfne = gfn as HTMLElement;
              if (gfn !== elem && gfne.dataset.title === data.title)
                scrollIntoView(gfne, parent, undefined, 30);
            });
          }
          break;
        }
        case 'crref': {
          if (data) {
            const { context, location } = data;
            if (context && location) {
              const { book, chapter, verse, lastverse, v11n } = location;
              const loc = {
                book,
                chapter,
                verse: verse || 1,
                lastverse: lastverse || 1,
                v11n,
              };
              Commands.goToLocationVK(loc, loc, undefined, rootRenderPromise());
            }
          }
          break;
        }
        case 'snbut': {
          if (data) {
            const { context, reflist } = data;
            if (context && reflist) {
              const search: SearchType = {
                module: context,
                searchtext: `lemma: ${reflist[0]}`,
                type: 'SearchAdvanced',
              };
              if (Build.isElectronApp) G.Commands.search(search);
              else
                Subscription.publish.setControllerState({
                  reset: randomID(),
                  card: {
                    name: 'search',
                    props: { initialState: search, onlyLucene: true },
                  },
                });
            }
          }
          break;
        }
        case 'popupCloseLink': {
          if (parent !== popupParent) {
            if (Build.isElectronApp) {
              G.Window.close();
            }
          } else {
            const s: Partial<PopupParentState> = { popupParent: null };
            this.setState(s);
          }
          break;
        }
        case 'popupBackLink': {
          this.setState((prevState: PopupParentState) => {
            let { elemdata } = prevState;
            if (elemdata) {
              elemdata = clone(elemdata);
              elemdata.pop();
              // set the gap so as to position popup under the mouse
              const gap = Math.round(e.clientY - popupY - 40);
              const s: Partial<PopupParentState> = {
                elemdata,
                gap,
              };
              return s;
            }
            return null;
          });
          break;
        }
        case 'towindow': {
          const { elemdata } = state;
          const boxes = parent.getElementsByClassName('npopupTX');
          const box = boxes ? boxes[0] : (null as HTMLElement | null);
          if (Build.isElectronApp && box) {
            const b = box.getBoundingClientRect();
            const popupState: Pick<PopupParentState, 'elemdata'> = { elemdata };
            G.Window.open({
              type: 'popupWin',
              allowMultiple: true,
              saveIfAppClosed: true,
              openWithBounds: {
                withinWindowID: windowArguments().id,
                x: Math.round(b.x),
                y: Math.round(b.y),
                width: Math.round(b.width),
                height: Math.round(b.height),
              },
              additionalArguments: { popupState },
              options: { title: 'popup' },
            });
            const s: Partial<PopupParentState> = { popupParent: null };
            this.setState(s);
          }
          break;
        }
        case 'requiremod': {
          // Add required modules to module manager suggestion list
          const { reflist } = data || {};
          if (reflist?.length) {
            const suggested = G.Prefs.getComplexValue(
              'moduleManager.suggested',
            ) as typeof S.prefs.moduleManager.suggested;
            const news = suggested || {};
            const locale = G.i18n.language;
            if (!(locale in news)) news[locale] = [];
            news[locale].unshift(...reflist);
            G.Prefs.setComplexValue('moduleManager.suggested', news);
            // Enable all repositories
            G.Prefs.setComplexValue(
              'moduleManager.repositories.disabled',
              null as typeof S.prefs.moduleManager.repositories.disabled,
            );
            // Open the module manager window, which should then auto-
            // download the suggestions.
            G.Commands.openModuleManager();
          }
          break;
        }
        default:
          throw Error(
            `Unhandled popupHandler click class: '${elem.className}'`,
          );
      }
      break;
    }

    case 'change': {
      const select = ofClass(['popup-mod-select'], es.target);
      if (select) {
        const t = select.element as HTMLSelectElement;
        const { value } = t;
        this.setState((prevState: PopupParentState) => {
          let { elemdata } = prevState;
          elemdata = clone(elemdata);
          if (t.dataset.module && elemdata?.length) {
            const orig = elemdata[elemdata.length - 1];
            if (orig.context && value) {
              G.Prefs.mergeValue('global.popup.vklookup', {
                [orig.context]: value,
              } as typeof S.prefs.global.popup.vklookup);
            }
          }
          if (t.dataset.feature) {
            G.Prefs.mergeValue('global.popup.feature', {
              [t.dataset.feature]: value,
            } as typeof S.prefs.global.popup.feature);
          }
          // Making a selection from a long dropdown may put the mouse outside
          // the popup after selection. So hold the popup open until the mouse
          // moves over the popup and then it leaves again.
          const s: Partial<PopupParentState> = {
            elemdata,
            popupHold: true,
            popupReset: prevState.popupReset + 1,
          };
          return s;
        });
      } else {
        const trg = es.target as HTMLElement;
        throw Error(`Unhandled popupHandler change event: '${trg.className}'`);
      }
      break;
    }

    case 'contextmenu': {
      const s: Partial<PopupParentState> = {
        popupHold: true,
      };
      this.setState(s);
      break;
    }

    case 'mousemove': {
      const { popupHold } = this.state as PopupParentState;
      if (popupHold) {
        const s: Partial<PopupParentState> = { popupHold: false };
        this.setState(s);
      }
      break;
    }

    case 'mouseleave': {
      const { popupParent, popupHold } = this.state as PopupParentState;
      const parent = popupParent || document.getElementById('root');
      if (parent && !popupHold) {
        const s: Partial<PopupParentState> = { popupParent: null };
        this.setState(s);
      }
      break;
    }

    default:
      throw Error(`Unhandled popupHandler event type: '${es.type}'`);
  }
}

// WebApp closes the popup if the user clicks outside of it.
let WindowClickFunc: ((e: MouseEvent) => void) | null = null;
export function popupUpClickClose(this: PopupParent, onlyRemove = false) {
  if (Build.isWebApp) {
    if (WindowClickFunc) window.removeEventListener('click', WindowClickFunc);
    if (!onlyRemove) {
      WindowClickFunc = (e: MouseEvent) => {
        const { popupParent } = this.state as PopupParentState;
        if (
          popupParent &&
          !ofClass('npopupTX', e.target, 'ancestor-or-self')
        ) {
          this.setState({ popupParent: null });
        }
      };
      window.addEventListener('click', WindowClickFunc);
    }
  }
}

import type React from 'react';
import Subscription from '../../../subscription.ts';
import { clone, ofClass, randomID } from '../../../common.ts';
import { goToLocationVK } from '../../../commands.ts';
import C from '../../../constant.ts';
import type S from '../../../defaultPrefs.ts';
import { G } from '../../G.ts';
import { findElementData, updateDataAttribute } from '../../htmlData.ts';
import {
  eventHandled,
  Events,
  isBlocked,
  onPointerLong,
  safeScrollIntoView,
  windowArguments,
} from '../../common.ts';
import log from '../../log.ts';
import { delayHandler } from '../libxul/xul.tsx';

import type { GType, PlaceType, SearchType, ShowType } from '../../../type.ts';
import type { RenderPromiseComponent } from '../../renderPromise.ts';
import type { HTMLData } from '../../htmlData.ts';
import type Atext from '../atext/atext.tsx';
import type Popup from './popup.tsx';
import type { PopupState } from './popup.tsx';

export type PopupParent = RenderPromiseComponent & {
  state: React.ComponentState;
  props: React.ComponentProps<any>;
  setState: React.Component['setState'];
  popupDelayTO?: NodeJS.Timeout | undefined | null;
  popupUnblockTO?: NodeJS.Timeout | undefined;
  popupHandler: typeof popupHandler;
  popupParentHandler?: typeof popupParentHandler;
  popupClickClose?: typeof popupClickClose; // For WebApp only
  popupRef?: React.RefObject<Popup>;
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

// Event handler for a container containing links to popups.
export function popupParentHandler(
  this: PopupParent,
  e: React.SyntheticEvent | PointerEvent,
  module?: string,
) {
  if (isBlocked(e)) return;
  const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : (e as Event);
  const ep = nativeEvent instanceof PointerEvent ? nativeEvent : null;
  const { pointerType } = ep ?? {};
  switch (e.type) {
    case 'pointerenter': {
      const parent = ofClass(['npopup'], e.target)?.element;
      // Hover over elements outside of a popup which are not 'x-target_self'
      // are handled here.
      if (parent) return;
      const { target } = e;
      const oc = ofClass(
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
        target,
      );
      if (!oc) return;
      const { type } = oc;
      let element = oc.element as HTMLElement | undefined;
      // searchterm will be a child span of sn and the sn parent is needed, not the searchterm.
      if (element?.classList.contains('searchterm')) {
        element = ofClass(['sn'], element)?.element;
      }
      if (!element) return;
      if (element.classList.contains('x-target_self')) return;
      const { props, state, popupDelayTO } = this;
      const { popupParent } = state;
      const { place: pl, show: sh, atextRefs, isPinned } = props;
      const modtype = module ? G.Tab[module].type : null;
      const atext = ofClass(['atext'], target);
      const index = Number(atext?.element?.dataset.index) || 0;
      const atr = ((atext && atextRefs?.[index].current) ||
        null) as PopupParent | null;
      const place: PlaceType | undefined =
        (atr && isPinned && isPinned[index] && atr.state.pin.place) || pl;
      const show: ShowType | undefined =
        (atr && isPinned && isPinned[index] && atr.state.pin.show) || sh;
      let openPopup = false;
      let gap = C.UI.Popup.openGap;
      const data = findElementData(element);
      if (popupDelayTO) {
        clearTimeout(popupDelayTO);
        this.popupDelayTO = undefined;
      }
      switch (type) {
        case 'cr':
          if (!place || place.crossrefs === 'popup') openPopup = true;
          break;
        case 'fn':
          // genbk fn are already embedded in the text
          if (
            (!place || place.footnotes === 'popup') &&
            modtype !== C.GENBOOK
          ) {
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
      if (data && openPopup && !popupParent && popupDelayTO !== null) {
        const func = (el: HTMLElement, dt: HTMLData, gp: number) => {
          updateDataAttribute(el, dt);
          this.setState({
            elemdata: [dt],
            gap: gp,
            popupParent: el,
          });
        };
        if (pointerType === 'mouse')
          delayHandler(
            this,
            func,
            [element, data, gap],
            type === 'sn' ? C.UI.Popup.strongsOpenDelay : C.UI.Popup.openDelay,
            'popupDelayTO',
          );
        else
          onPointerLong(
            () => func(element, data, gap),
            C.UI.WebApp.shortTouchTO,
          )(e as any);
      }
      break;
    }

    case 'pointermove': {
      const { popupDelayTO } = this;
      if (typeof popupDelayTO !== 'undefined') {
        // Unblock popup after mouse wheel scrolling.
        const wheelScrollUnblock = popupDelayTO === null;
        if (wheelScrollUnblock) this.popupDelayTO = undefined; // unblocks pup
      }
      break;
    }

    case 'pointerleave': {
      if (pointerType === 'mouse' && this.popupDelayTO) {
        clearTimeout(this.popupDelayTO);
        this.popupDelayTO = undefined;
      }
      break;
    }

    case 'wheel': {
      // Block popup for a time when mouse-wheel is turned, and then
      // wait until the mouse moves again before re-enabling the popup.
      if (pointerType === 'mouse')
        blockpopup(this, C.UI.Popup.wheelDeadTime, true);
      break;
    }

    default:
      if (Build.isDevelopment)
        log.warn(`Unhandled popupParentH event type: '${e.type}'`);
      return;
  }

  eventHandled(e);
}

// Event handler for the popup itself.
export function popupHandler(
  this: PopupParent,
  e: React.SyntheticEvent | PointerEvent,
) {
  if (isBlocked(e)) return;
  const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : (e as Event);
  const ep = nativeEvent instanceof PointerEvent ? nativeEvent : null;
  const { pointerType } = ep ?? {};
  switch (e.type) {
    case 'pointerdown': {
      const oc = ofClass(
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
        e.target,
      );
      if (!oc) return;
      const { state } = this;
      const { popupParent } = state;
      const { element, type } = oc;
      const parent = popupParent || document.getElementById('root');
      // Require popup or window parent but don't search beyond npopup when testing type
      if (!parent || type === 'npopup') return;
      e.preventDefault();
      e.stopPropagation();
      const data = findElementData(element);
      const popupY = parent.getBoundingClientRect().y;
      switch (type) {
        case 'fn':
        case 'sn':
        case 'cr':
        case 'sr':
        case 'dt':
        case 'dtl': {
          if (ep && data && !element.classList.contains('empty')) {
            const func = (ep: PointerEvent, data: HTMLData) => {
              this.setState((prevState: PopupParentState) => {
                let { elemdata, gap } = prevState;
                if (elemdata === null) elemdata = [];
                else elemdata = clone(elemdata);
                // sn links within sn popups should keep their original context
                if (elemdata.at(-1)?.type === 'sn' && data.type === 'sn') {
                  data.context = elemdata.at(-1)?.context;
                }
                elemdata.push(data);
                // set the gap so as to position popup under the mouse
                if (pointerType === 'mouse')
                  gap = Math.round(ep.clientY - popupY - 40);
                return {
                  elemdata,
                  gap,
                };
              });
            };
            if (pointerType === 'mouse')
              delayHandler(
                this,
                func,
                [ep, data],
                pointerType === 'mouse' ? 1 : C.UI.Popup.openDelay,
                'popupDelayTO',
              );
            else
              onPointerLong(
                () => func(ep, data),
                C.UI.WebApp.shortTouchTO,
              )(e as any);
          }
          break;
        }
        case 'gfn': {
          if (data) {
            const gfns = parent.getElementsByClassName('gfn');
            Array.from(gfns).forEach((gfn) => {
              const gfne = gfn as HTMLElement;
              if (gfn !== element && gfne.dataset.title === data.title)
                safeScrollIntoView(gfne, parent, undefined, 30);
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
              void goToLocationVK(loc, loc);
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
              if (Build.isElectronApp) (G as GType).Commands.search(search);
              else
                Subscription.publish.setControllerState(
                  {
                    reset: randomID(),
                    card: {
                      name: 'search',
                      props: { initialState: search, onlyLucene: true },
                    },
                  },
                  true,
                );
            }
          }
          break;
        }
        case 'popupCloseLink': {
          if (parent !== popupParent) {
            if (Build.isElectronApp) {
              (G as GType).Window.close();
            }
          } else {
            this.setState({ popupParent: null });
            // Multiple events may fire, and if the popup closes, ignore
            // them all, as the context is now different.
            blockpopup(this, C.UI.Popup.closeDeadTime, false);
          }
          break;
        }
        case 'popupBackLink': {
          this.setState((prevState: PopupParentState) => {
            let { elemdata, gap } = prevState;
            if (elemdata) {
              elemdata = clone(elemdata);
              elemdata.pop();
              // set the gap so as to position popup under the mouse
              if (ep && pointerType === 'mouse')
                gap = Math.round(ep.clientY - popupY - 40);
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
            (G as GType).Window.open({
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
            this.setState({ popupParent: null });
          }
          break;
        }
        case 'requiremod': {
          // Add required modules to module manager suggestion list
          const { reflist } = data || {};
          if (Build.isElectronApp && reflist?.length) {
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
            (G as GType).Commands.openModuleManager();
          }
          break;
        }
        default:
          if (Build.isDevelopment)
            log.warn(
              `Unhandled popupHandler click class: '${element.className}'`,
            );
          return;
      }
      break;
    }

    case 'pointermove': {
      const { popupHold } = this.state;
      if (popupHold) {
        this.setState({ popupHold: false });
      }
      break;
    }

    // Close the popup when the mouse leaves it.
    case 'pointerleave': {
      const { popupRef } = this;
      const { popupParent, popupHold } = this.state;
      const parent = popupParent || document.getElementById('root');
      if (
        parent &&
        !popupHold &&
        !(popupRef?.current?.state as PopupState).drag?.dragging &&
        pointerType === 'mouse'
      ) {
        this.setState({ popupParent: null });
        blockpopup(this, C.UI.Popup.closeDeadTime, false);
      }
      break;
    }

    case 'change': {
      const oc = ofClass(['popup-mod-select'], e.target);
      if (oc) {
        const { element, type } = oc;
        const t = element as HTMLSelectElement;
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
          return {
            elemdata,
            popupHold: true,
            popupReset: prevState.popupReset + 1,
          };
        });
      } else {
        const trg = e.target as HTMLElement;
        if (Build.isDevelopment)
          log.warn(`Unhandled popupHandler change event: '${trg.className}'`);
        return;
      }
      break;
    }

    case 'contextmenu': {
      this.setState({ popupHold: true });
      break;
    }

    default:
      if (Build.isDevelopment)
        log.warn(`Unhandled popupHandler event type: '${e.type}'`);
      return;
  }

  eventHandled(e);
}

// Cancel any pending open-popup, block handlers for a length of time, and
// optionally wait to re-enable open-popup until the next mousemove is handled.
function blockpopup(
  xthis: PopupParent,
  length: number,
  thenWaitUntilMouseMoves = false,
) {
  if ('popupDelayTO' in xthis) {
    if (xthis.popupDelayTO) clearTimeout(xthis.popupDelayTO);
    xthis.popupDelayTO = null; // blocks the popup
    Events.blocked = true;
    delayHandler(
      xthis,
      () => {
        Events.blocked = false;
        // Hoverable re-enables after the mouse moves, otherwise re-enable now.
        if (!thenWaitUntilMouseMoves) xthis.popupDelayTO = undefined;
      },
      [],
      length,
      'popupUnblockTO',
    );
  }
}

// Close the popup and/or unhilight strongs numbers if the user clicks outside
// of the popup.
export function popupClickClose(this: any, e: React.PointerEvent) {
  const { popupParent } = this.state as PopupParentState;
  cancelStrongsHiLights();
  if (
    popupParent &&
    popupParent !== e.target &&
    !ofClass('npopupTX', e.target, 'ancestor-or-self')
  ) {
    this.setState({ popupParent: null });
    blockpopup(this, C.UI.Popup.closeDeadTime, false);
  }
}

export const Hilight = {
  strongsCSS: [] as { sheet: CSSStyleSheet; index: number }[],
};

export function cancelStrongsHiLights() {
  Hilight.strongsCSS
    .sort((a, b) => b.index - a.index)
    .forEach((r) => {
      try {
        r.sheet.deleteRule(r.index);
      } catch (er) {
        /* empty */
      }
    });
  Hilight.strongsCSS = [];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import C from '../../constant';
import { clone, JSON_stringify, ofClass } from '../../common';
import { findElementData, updateDataAttribute } from '../htmlData';
import G from '../rg';
import { scrollIntoView } from '../rutil';
import { delayHandler } from '../libxul/xul';
import { getPopupHTML } from './popupH';

import type { PlaceType, ShowType } from '../../type';
import type { HTMLData } from '../htmlData';
import type Atext from '../viewport/atext';

let WheelScrolling = false;

export interface PopupParent {
  state: React.ComponentState;
  props: React.ComponentProps<any>;
  setState: React.Component['setState'];
  popupDelayTO?: NodeJS.Timeout | undefined | null;
  popupUnblockTO?: NodeJS.Timeout | undefined;
  popupHandler: typeof popupHandler;
  popupParentHandler?: typeof popupParentHandler;
}

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
  atextRefs: React.RefObject<Atext>[];
};

export function popupParentHandler(
  this: PopupParent,
  es: React.SyntheticEvent,
  module?: string
) {
  switch (es.type) {
    case 'mouseover': {
      const ppar = ofClass(['npopup'], es.target);
      const parent = ppar?.element;
      // Only mouseovers outside of a popup which are not 'x-target_self' are handled here.
      if (parent) return;
      let targ = ofClass(
        ['cr', 'fn', 'un', 'sn', 'sr', 'dt', 'dtl', 'introlink', 'searchterm'],
        es.target,
        'self'
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
      const index = Number(atext?.element && atext.element.dataset.index) || 0;
      const atr = ((atext && atextRefs && atextRefs[index].current) ||
        null) as PopupParent | null;
      const place: PlaceType | undefined =
        (atr && isPinned && isPinned[index] && atr.state.pin.place) || pl;
      const show: ShowType | undefined =
        (atr && isPinned && isPinned[index] && atr.state.pin.show) || sh;
      const e = es as React.MouseEvent;
      const { popupDelayTO } = this;
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
        case 'introlink':
          openPopup = true;
          break;
        default:
      }
      if (data && openPopup && !popupParent) {
        if (getPopupHTML(data, true)) {
          delayHandler.bind(this)(
            (el: HTMLElement, dt: HTMLData, gp: number) => {
              updateDataAttribute(el, dt);
              const s: Partial<PopupParentState> = {
                elemdata: [dt],
                gap: gp,
                popupParent: el,
              };
              this.setState(s);
            },
            targ.type === 'sn'
              ? C.UI.Popup.strongsOpenDelay
              : C.UI.Popup.openDelay,
            'popupDelayTO'
          )(elem, data, gap);
        } else {
          elem.classList.add('empty');
        }
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
        delayHandler.bind(this)(
          () => {
            WheelScrolling = false;
          },
          C.UI.Popup.wheelDeadTime,
          'popupUnblockTO'
        )(this);
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
        ],
        es.target
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
              let { elemdata } = clone(prevState);
              if (elemdata === null) elemdata = [];
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
            Array.from(gfns).forEach((gfn: any) => {
              if (gfn !== elem && gfn.dataset.title === data.title)
                scrollIntoView(gfn, parent);
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
              G.Commands.goToLocationVK(loc, loc);
            }
          }
          break;
        }
        case 'snbut': {
          if (data) {
            const { context, reflist } = data;
            if (context && reflist)
              G.Commands.search({
                module: context,
                searchtext: `lemma: ${reflist[0]}`,
                type: 'SearchAdvanced',
              });
          }
          break;
        }
        case 'popupCloseLink': {
          if (parent !== popupParent) G.Window.close();
          else {
            const s: Partial<PopupParentState> = { popupParent: null };
            this.setState(s);
          }
          break;
        }
        case 'popupBackLink': {
          this.setState((prevState: PopupParentState) => {
            const { elemdata } = clone(prevState);
            if (elemdata) {
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
          if (box) {
            const b = box.getBoundingClientRect();
            const popupState: Pick<PopupParentState, 'elemdata'> = { elemdata };
            const options = {
              title: 'popup',
              additionalArguments: { popupState },
              openWithBounds: {
                x: Math.round(b.x),
                y: Math.round(b.y),
                width: Math.round(b.width),
                height: Math.round(b.height),
              },
            };
            G.Window.open({ type: 'popupWin', options });
            const s: Partial<PopupParentState> = { popupParent: null };
            this.setState(s);
          }
          break;
        }
        default:
          throw Error(
            `Unhandled popupHandler click class: '${elem.className}'`
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
          const { elemdata } = clone(prevState);
          if (t.dataset.module && elemdata && elemdata.length) {
            const orig = elemdata[elemdata.length - 1];
            if (orig.context && value) {
              G.Prefs.setCharPref(
                `global.popup.selection.${orig.context}`,
                value
              );
            }
          }
          if (t.dataset.feature) {
            G.Prefs.setCharPref(
              `global.popup.selection.${t.dataset.feature}`,
              value
            );
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

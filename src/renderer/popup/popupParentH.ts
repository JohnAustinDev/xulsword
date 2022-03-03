/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import C from '../../constant';
import { JSON_stringify, ofClass } from '../../common';
import { getPopupInfo } from '../../libswordElemInfo';
import G from '../rg';
import { getContextModule } from '../rutil';
import { delayHandler } from '../libxul/xul';

import type { ElemInfo } from '../../libswordElemInfo';
import type { PlaceType, ShowType } from '../../type';

let WheelScrolling = false;

export interface PopupParent {
  state: React.ComponentState;
  props: React.ComponentProps<any>;
  setState: React.Component['setState'];
  popupHandler: typeof popupHandler;
  popupDelayTO?: NodeJS.Timeout | undefined | null;
  popupUnblockTO?: NodeJS.Timeout | undefined;
  popupParentHandler?: typeof popupParentHandler;
}

export type PopupParentProps = {
  place: PlaceType;
  show: ShowType;
};

export type PopupParentState = {
  elemhtml: string[] | null; // popup target element html
  eleminfo: ElemInfo[] | null; // popup target element info
  popupReset: number; // increment this to re-mount popup
  gap?: number; // gap between target element and top of popup
  popupHold?: boolean; // hold popup open
  popupParent?: HTMLElement | null; // popup location
};

export function popupParentHandler(
  this: PopupParent,
  es: React.SyntheticEvent,
  module: string | undefined
) {
  const state = this.state as PopupParentState;
  const props = this.props as PopupParentProps;
  const { place, show } = props;
  const target = es.target as HTMLElement;
  const type = module ? G.Tab[module].type : null;
  switch (es.type) {
    case 'mouseover': {
      const e = es as React.MouseEvent;
      const { popupDelayTO } = this;
      const { popupParent } = state;
      if (popupDelayTO) clearTimeout(popupDelayTO);
      const ppar = ofClass(['npopup'], target);
      const parent = ppar?.element;
      // Only mouseovers outside of a popup which are not 'x-target_self' are handled here.
      if (parent) return;
      const targ = ofClass(
        ['cr', 'fn', 'un', 'sn', 'sr', 'dt', 'dtl', 'introlink', 'noticelink'],
        target,
        true
      );
      if (targ === null || targ.element.classList.contains('x-target_self'))
        return;
      e.preventDefault();
      const elem = targ.element;
      let openPopup = false;
      let gap = C.UI.Popup.openGap;
      const info = getPopupInfo(elem);
      if (info && targ.type === 'sn') info.mod = getContextModule(elem) || null;
      switch (targ.type) {
        case 'cr':
          if (place.crossrefs === 'popup') openPopup = true;
          break;
        case 'fn':
          // genbk fn are already embedded in the text
          if (place.footnotes === 'popup' && type !== C.GENBOOK) {
            openPopup = true;
          }
          break;
        case 'un':
          if (
            place.usernotes === 'popup' ||
            (module && !G.Tab[module].isVerseKey)
          ) {
            openPopup = true;
          }
          break;
        case 'sn':
          if (show.strongs) {
            openPopup = true;
            gap = C.UI.Popup.strongsOpenGap;
          }
          break;
        case 'sr':
        case 'dt':
        case 'dtl':
        case 'introlink':
        case 'noticelink':
          openPopup = true;
          break;
        default:
      }
      if (openPopup && !popupParent) {
        delayHandler.bind(this)(
          (el: HTMLElement, ifo: ElemInfo, gp: number) => {
            const s: Partial<PopupParentState> = {
              elemhtml: [el.outerHTML],
              eleminfo: [ifo || ({} as ElemInfo)],
              gap: gp,
              popupParent: el,
            };
            this.setState(s);
          },
          targ.type === 'sn'
            ? C.UI.Popup.strongsOpenDelay
            : C.UI.Popup.openDelay,
          'popupDelayTO'
        )(elem, info, gap);
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
  const state = this.state as PopupParentState;
  const { popupParent, popupHold } = state;
  const target = es.target as HTMLElement;
  const parent = popupParent || document.getElementById('root');
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
          'popupCloseLink',
          'popupBackLink',
          'towindow',
          'pupselect',
          'snbut',
          'npopup',
        ],
        target
      );
      // Require popup or window parent but don't search beyond npopup when testing type
      if (!parent || targ === null || targ.type === 'npopup') return;
      e.preventDefault();
      e.stopPropagation();
      const elem = targ.element;
      const info = getPopupInfo(elem);
      const popupY = parent.getBoundingClientRect().y;
      if (info && targ.type === 'sn') info.mod = getContextModule(elem) || null;
      switch (targ.type) {
        case 'fn':
        case 'sn':
        case 'cr':
        case 'sr':
        case 'dt':
        case 'dtl': {
          this.setState((prevState: PopupParentState) => {
            let { elemhtml, eleminfo } = prevState;
            if (elemhtml === null) elemhtml = [];
            if (eleminfo === null) eleminfo = [];
            elemhtml.push(elem.outerHTML);
            eleminfo.push(info || ({} as ElemInfo));
            // set the gap so as to position popup under the mouse
            const gap = Math.round(e.clientY - popupY - 40);
            const s: Partial<PopupParentState> = {
              elemhtml,
              eleminfo,
              gap,
            };
            return s;
          });
          break;
        }
        case 'popupCloseLink': {
          if (parent !== popupParent)
            window.ipc.renderer.send('window', 'close');
          else {
            const s: Partial<PopupParentState> = { popupParent: null };
            this.setState(s);
          }
          break;
        }
        case 'popupBackLink': {
          this.setState((prevState: PopupParentState) => {
            const { elemhtml, eleminfo } = prevState;
            if (elemhtml && eleminfo) {
              elemhtml.pop();
              eleminfo.pop();
              // set the gap so as to position popup under the mouse
              const gap = Math.round(e.clientY - popupY - 40);
              const s: Partial<PopupParentState> = {
                elemhtml,
                eleminfo,
                gap,
              };
              return s;
            }
            return null;
          });
          break;
        }
        case 'towindow': {
          const { elemhtml, eleminfo } = state;
          const boxes = parent.getElementsByClassName('npopupTX');
          const box = boxes ? boxes[0] : (null as HTMLElement | null);
          if (box) {
            const b = box.getBoundingClientRect();
            const options = {
              title: 'popup',
              webPreferences: {
                additionalArguments: [
                  JSON_stringify({
                    popupState: {
                      elemhtml,
                      eleminfo,
                    },
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
            G.openWindow('popupWin', options);
            const s: Partial<PopupParentState> = { popupParent: null };
            this.setState(s);
          }
          break;
        }
        case 'snbut': {
          if (info && info.ch && info.mod)
            G.Commands.search({
              module: info.mod,
              searchtext: `lemma: ${info.ch}`,
              type: 'SearchAdvanced',
            });
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
      const select = ofClass(['popup-mod-select'], target);
      if (select) {
        const t = select.element as HTMLSelectElement;
        const { value } = t;
        this.setState((prevState: PopupParentState) => {
          const { elemhtml, eleminfo } = prevState;
          if (
            t.dataset.module &&
            elemhtml &&
            elemhtml.length &&
            eleminfo &&
            eleminfo.length
          ) {
            const orig = getPopupInfo(elemhtml[elemhtml.length - 1]);
            if (orig.mod && value) {
              G.Prefs.setCharPref(`global.popup.selection.${orig.mod}`, value);
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
            eleminfo,
            popupHold: true,
            popupReset: prevState.popupReset + 1,
          };
          return s;
        });
      } else {
        throw Error(
          `Unhandled popupHandler change event: '${target.className}'`
        );
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
      if (popupHold) {
        const s: Partial<PopupParentState> = { popupHold: false };
        this.setState(s);
      }
      break;
    }

    case 'mouseleave': {
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

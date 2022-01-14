/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/no-cycle */
import React from 'react';
import C from '../../constant';
import { PlaceType, ShowType } from '../../type';
import { getContextModule, ofClass } from '../../common';
import { TextInfo } from '../../textclasses';
import G from '../rg';
import { getPopupInfo } from '../rutil';
import Popup from './popup';

export interface PopupParent {
  state: React.Component['state'];
  props: React.Component['props'];
  setState: React.Component['setState'];
  popupHandler: typeof popupHandler;
  popupDelayTO?: NodeJS.Timeout | undefined;
  popupParentHandler?: typeof popupParentHandler;
}

export type PopupParentProps = {
  place: PlaceType;
  show: ShowType;
};

export type PopupParentState = {
  elemhtml: string[]; // popup target element html
  eleminfo: TextInfo[]; // popup target element info
  popupReset: number; // increment this to re-mount popup
  gap?: number; // popup gap
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
      let gap = 0;
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
            gap = 80;
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
        if (this.popupDelayTO) clearTimeout(this.popupDelayTO);
        this.popupDelayTO = setTimeout(
          () => {
            const s: Partial<PopupParentState> = {
              elemhtml: [elem.outerHTML],
              eleminfo: [info || ({} as TextInfo)],
              gap,
              popupParent: elem,
            };
            this.setState(s);
          },
          targ.type === 'sn' ? Popup.POPUPDELAY_STRONGS : Popup.POPUPDELAY
        );
      }
      break;
    }

    case 'mouseout': {
      if (this.popupDelayTO) clearTimeout(this.popupDelayTO);
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
            const { elemhtml, eleminfo } = prevState;
            elemhtml.push(elem.outerHTML);
            eleminfo.push(info || ({} as TextInfo));
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
                  'popup',
                  JSON.stringify(elemhtml),
                  JSON.stringify(eleminfo),
                ],
              },
              openWithBounds: {
                x: Math.round(b.x),
                y: Math.round(b.y),
                width: Math.round(b.width),
                height: Math.round(b.height),
              },
            };
            G.openWindow('popup', options);
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
      const select = ofClass(['popup-mod-select'], target);
      if (select) {
        const t = select.element as HTMLSelectElement;
        const { value } = t;
        this.setState((prevState: PopupParentState) => {
          const { eleminfo } = prevState;
          if (t.dataset.module && eleminfo.length) {
            // Not converting v11n here, because elemhtml text nodes would need
            // conversion if reflist is not provided.
            eleminfo[eleminfo.length - 1].ntype = value;
          }
          if (t.dataset.feature) {
            G.Prefs.setCharPref(`popup.selection.${t.dataset.feature}`, value);
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

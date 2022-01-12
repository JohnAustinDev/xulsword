/* eslint-disable import/no-cycle */
import React from 'react';
import C from '../../constant';
import { getContextModule, getElementInfo, ofClass } from '../../common';
import { TextInfo } from '../../textclasses';
import G from '../rg';
import Popup from '../popup/popup';
import PopupWin from '../popup/popupWin';
import Viewport, { ViewportProps, ViewportState } from './viewport';

import '../libxul/xul.css';
import './viewport.css';

export default function handler(this: Viewport, es: React.SyntheticEvent) {
  const { modules, place, show } = this.props as ViewportProps;
  const target = es.target as HTMLElement;
  const atxt = ofClass(['atext'], target);
  const atext = atxt?.element;
  const n = Number(atext?.dataset.wnum);
  const i = n - 1;
  const module = modules[i];
  const type = module ? G.Tab[module].type : null;
  switch (es.type) {
    case 'mouseover': {
      const e = es as React.MouseEvent;
      const { popupDelayTO } = this;
      const { popupPosition } = this.state as ViewportState;
      if (popupDelayTO) clearTimeout(popupDelayTO);
      const ppar = ofClass(['npopup'], target);
      const popupParent = ppar?.element;
      // Only mouseovers outside of a popup which are not 'x-target_self' are handled here.
      if (popupParent) return;
      const targ = ofClass(
        ['cr', 'fn', 'un', 'sn', 'sr', 'dt', 'dtl', 'introlink', 'noticelink'],
        target,
        true
      );
      if (targ === null || targ.element.classList.contains('x-target_self'))
        return;
      e.preventDefault();
      const elem = targ.element;
      const elemY = elem.getBoundingClientRect().y;
      let openPopup = false;
      const info = getElementInfo(elem);
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
      if (openPopup && popupPosition !== elem) {
        if (this.popupDelayTO) clearTimeout(this.popupDelayTO);
        this.popupDelayTO = setTimeout(
          () =>
            this.setState({
              elemhtml: [elem.outerHTML],
              eleminfo: [info],
              elemY: [Math.round(elemY)],
              popupPosition: elem,
            }),
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
      throw Error(`Unhandled viewportH event type: '${es.type}'`);
  }
}

export function popupHandler(
  this: Viewport | PopupWin,
  es: React.SyntheticEvent
) {
  const target = es.target as HTMLElement;
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
          'npopup',
        ],
        target
      );
      // Ignore popup ancestors when testing type
      if (targ === null || targ.type === 'npopup') return;
      e.preventDefault();
      e.stopPropagation();
      const elem = targ.element;
      const pupY = elem.getBoundingClientRect().y;
      const info = getElementInfo(elem);
      if (info && targ.type === 'sn') info.mod = getContextModule(elem) || null;
      switch (targ.type) {
        case 'fn':
        case 'sn':
        case 'cr':
        case 'sr':
        case 'dt':
        case 'dtl': {
          this.setState((prevState: ViewportState) => {
            const { elemhtml, eleminfo, elemY } = prevState;
            elemhtml.push(elem.outerHTML);
            eleminfo.push(info || ({} as TextInfo));
            elemY.push(Math.round(pupY));
            return { elemhtml, eleminfo, elemY };
          });
          break;
        }
        case 'popupCloseLink': {
          const popupWin = ofClass(['popupWin'], target);
          if (popupWin) window.ipc.renderer.send('window', 'close');
          else this.setState({ popupPosition: null });
          break;
        }
        case 'popupBackLink': {
          this.setState((prevState: ViewportState) => {
            const { elemhtml, eleminfo, elemY } = prevState;
            elemhtml.pop();
            eleminfo.pop();
            elemY.pop();
            return { elemhtml, eleminfo, elemY };
          });
          break;
        }
        case 'towindow': {
          const { elemhtml, eleminfo, elemY } = this.state as ViewportState;
          const boxes = document.getElementsByClassName('npopupBOX');
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
                  JSON.stringify(elemY),
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
            this.setState({ popupPosition: null });
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
        this.setState((prevState: ViewportState) => {
          const { eleminfo } = prevState;
          if (t.dataset.module && eleminfo.length) {
            // Not converting v11n here, because elemhtml text nodes would need
            // conversion if reflist is not provided.
            eleminfo[eleminfo.length - 1].mod = value;
          }
          if (t.dataset.feature) {
            G.Prefs.setCharPref(`popup.selection.${t.dataset.feature}`, value);
          }
          return { eleminfo };
        });
      } else {
        throw Error(
          `Unhandled popupHandler change event: '${target.className}'`
        );
      }
      break;
    }
    case 'mouseleave': {
      const { popupPosition } = this.state as ViewportState;
      if (popupPosition) this.setState({ popupPosition: null });
      break;
    }
    default:
      throw Error(`Unhandled popupHandler event type: '${es.type}'`);
  }
}

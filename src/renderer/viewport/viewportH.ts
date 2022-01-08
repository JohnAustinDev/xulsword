/* eslint-disable import/no-cycle */
import React from 'react';
import C from '../../constant';
import { ofClass } from '../../common';
import G from '../rg';
import Popup from '../popup/popup';
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
    case 'click': {
      const e = es as React.MouseEvent;
      const targ = ofClass(
        ['sr', 'dt', 'dtl', 'popupCloseLink', 'towindow'],
        target
      );
      if (targ === null) return;
      e.preventDefault();
      const elem = targ.element;
      switch (targ.type) {
        case 'sr':
        case 'dt':
        case 'dtl':
          if (
            !elem.classList.contains('x-target_self') ||
            type !== C.DICTIONARY
          ) {
            this.setState({ popup: elem });
            es.stopPropagation();
          }
          break;
        case 'towindow':
        case 'popupCloseLink': {
          this.setState({ popup: null });
          break;
        }
        default:
      }
      break;
    }

    case 'mouseover': {
      const e = es as React.MouseEvent;
      const { popupDelayTO } = this;
      const { popup } = this.state as ViewportState;
      if (popupDelayTO) clearTimeout(popupDelayTO);
      const targ = ofClass(
        ['cr', 'fn', 'un', 'sn', 'sr', 'dt', 'dtl', 'introlink', 'noticelink'],
        target,
        true
      );
      if (targ === null) return;
      e.preventDefault();
      const elem = targ.element;
      const ppar = ofClass(['npopup'], target);
      const popupParent = ppar?.element;
      if (!popupParent) {
        let openPopup = false;
        switch (targ.type) {
          case 'cr':
            if (place.crossrefs === 'popup') openPopup = true;
            break;
          case 'fn':
            // genbk fn are embedded in text
            if (type === C.GENBOOK || place.footnotes === 'popup') {
              openPopup = true;
            }
            break;
          case 'un':
            if (
              place.usernotes === 'popup' ||
              (type !== C.BIBLE && type !== C.COMMENTARY)
            ) {
              openPopup = true;
            }
            break;
          case 'sn':
            if (show.strongs) openPopup = true;
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
        if (openPopup && popup !== elem) {
          if (this.popupDelayTO) clearTimeout(this.popupDelayTO);
          this.popupDelayTO = setTimeout(
            () => this.setState({ popup: elem }),
            targ.type === 'sn' ? Popup.POPUPDELAY_STRONGS : Popup.POPUPDELAY
          );
        }
      }
      break;
    }

    case 'mouseout': {
      if (this.popupDelayTO) clearTimeout(this.popupDelayTO);
      break;
    }

    case 'mouseleave': {
      const { popup } = this.state as ViewportState;
      if (popup) this.setState({ popup: null });
      break;
    }

    default:
      throw Error(`Unhandled viewportH event type: '${es.type}'`);
  }
}

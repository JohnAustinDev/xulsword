/* eslint-disable import/no-cycle */
import React from 'react';
import C from '../../constant';
import { ofClass } from '../../common';

import '../libxul/xul.css';
import './viewport.css';
import G from '../rg';
import Viewport, { ViewportProps } from './viewport';

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
        [
          'fn',
          'sn',
          'cr',
          'sr',
          'dt',
          'dtl',
          'popupBackLink',
          'popupCloseLink',
        ],
        target
      );
      if (targ === null) return;
      e.preventDefault();
      const elem = targ.element;
      const ppar = ofClass(['npopup'], target);
      const popupParent = ppar?.element;
      switch (targ.type) {
        case 'fn':
        case 'sn':
        case 'cr': {
          if (popupParent) {
            this.setState({ popup: elem });
          }
          break;
        }
        case 'sr':
        case 'dt':
        case 'dtl':
        case 'popupBackLink':
          if (
            popupParent ||
            !elem.classList.contains('x-target_self') ||
            type !== C.DICTIONARY
          ) {
            this.setState({ popup: elem });
            es.stopPropagation();
          }
          break;
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
      const targ = ofClass(
        ['cr', 'fn', 'un', 'sn', 'sr', 'dt', 'dtl', 'introlink', 'noticelink'],
        target
      );
      if (targ === null) return;
      e.preventDefault();
      const elem = targ.element;
      const ppar = ofClass(['npopup'], target);
      const popupParent = ppar?.element;
      switch (targ.type) {
        case 'cr':
          if (place.crossrefs !== 'notebox') {
            this.setState({ popup: elem });
          }
          break;
        case 'fn':
          // genbk fn are embedded in text
          if (!popupParent && type === C.GENBOOK) return;
          if (place.footnotes !== 'notebox') {
            this.setState({ popup: elem });
          }
          break;
        case 'un':
          if (
            place.usernotes !== 'notebox' ||
            (type !== C.BIBLE && type !== C.COMMENTARY)
          ) {
            this.setState({ popup: elem });
          }
          break;
        case 'sn':
          if (show.strongs) {
            this.setState({ popup: elem });
          }
          break;
        case 'sr':
        case 'dt':
        case 'dtl':
        case 'introlink':
        case 'noticelink':
          this.setState({ popup: elem });
          break;
        default:
      }
      break;
    }

    default:
  }
}

/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import {
  cleanDoubleClickSelection,
  clone,
  getCSS,
  ofClass,
  sanitizeHTML,
} from '../../common';
import C from '../../constant';
import S from '../../defaultPrefs';
import G from '../rg';
import { getElementData } from '../htmlData';
import log from '../log';
import { scrollIntoView } from '../rutil';
import { aTextWheelScroll, getRefHTML } from './zversekey';

import type Atext from './atext';
import type { AtextProps, AtextStateType } from './atext';

let AddedRules: { sheet: CSSStyleSheet; index: number }[] = [];

function scroll2Note(atext: HTMLElement, id: string) {
  Array.from(atext.getElementsByClassName('fnselected')).forEach((note) => {
    note.classList.remove('fnselected');
  });
  const note = document.getElementById(id);
  if (!note) return false;
  note.classList.add('fnselected');
  scrollIntoView(note, atext);
  return true;
}

export default function handler(this: Atext, es: React.SyntheticEvent) {
  switch (es.type) {
    case 'click': {
      const e = es as React.MouseEvent;
      const targ = ofClass(
        [
          'cr',
          'crtwisty',
          'versePerLineButton',
          'image-viewport',
          'dictkeyinput',
        ],
        es.target
      );
      if (targ === null) return;
      const props = this.props as AtextProps;
      const { module, panelIndex: index } = props;
      const target = es.target as HTMLElement;
      const atext = es.currentTarget as HTMLElement;
      e.preventDefault();
      let popupParent: any = ofClass(['npopup'], target);
      popupParent = popupParent ? popupParent.element : null;
      const elem = targ.element;
      const p = getElementData(elem);
      const { title, type: ptype } = p;
      switch (targ.type) {
        case 'cr':
        case 'crtwisty':
          if (!popupParent && module) {
            let row;
            let id;
            if (targ.type === 'cr' && p) {
              id = `w${index}.footnote.${ptype}.${title}`;
              row = document.getElementById(id);
            } else {
              const rowx = ofClass(['fnrow'], elem);
              if (rowx) row = rowx.element;
            }
            if (row) {
              const { location } = getElementData(row);
              row.classList.toggle('cropened');
              const col5 = ofClass('fncol5', row, 'descendant');
              if (col5 && location) {
                const el = col5.element;
                const refs = el.dataset.reflist;
                if (refs) {
                  sanitizeHTML(
                    el,
                    getRefHTML(
                      refs,
                      module,
                      location,
                      row.classList.contains('cropened'),
                      false
                    )
                  );
                }
              }
              if (id) scroll2Note(atext, id);
            }
          }
          break;

        case 'versePerLineButton':
          this.setState((prevState: AtextStateType) => {
            const { versePerLine } = prevState;
            return { versePerLine: !versePerLine };
          });
          break;

        case 'image-viewport': {
          // When an image-viewport is clicked, the viewport's current width and height
          // will become fixed and it will be made the relative ancestor of the scroll-
          // container, which will become absolutely positioned. With the mouse cursor
          // position in the viewport recorded as (Xt, Yt) the image is resized to its
          // natural width and height and the scroll-container top and left are set to
          // calculated (Xn, Yn) such that the image pixel that was under the cursor when
          // it was clicked will remain under the cursor after the image is resized to
          // its natural size. If clicked again, the image will be resized back to the
          // viewport width with scroll-container top and left set to 0.
          // Yn = Y(1 - (Wi/Wv))
          // WHERE:
          // Yn = CSS top value of the image container with respect to viewport
          // Y = Y coordinate of the cursor within the viewport (containing the fit image)
          // Wi = Width of the natural image
          // Wv = Width of the viewport
          const viewport = elem as HTMLDivElement;
          const scrollcn = viewport.firstChild as HTMLDivElement;
          const img = scrollcn?.firstChild as HTMLImageElement | undefined;
          let expandShrink: boolean | undefined;
          if (img) {
            const scrollcnS = window.getComputedStyle(scrollcn, null);
            if (scrollcnS.position === 'absolute') {
              expandShrink = img.style.width !== `${img.naturalWidth}px`;
            } else if (img.width < img.naturalWidth) {
              expandShrink = true;
              const viewportS = window.getComputedStyle(viewport, null);
              const vph = viewportS.height;
              const vpw = viewportS.width;
              viewport.style.height = vph;
              viewport.style.width = vpw;
              viewport.style.position = 'relative';
              viewport.style.overflow = 'visible';
              scrollcn.style.position = 'absolute';
            }
            if (expandShrink !== undefined) {
              if (expandShrink) {
                const cbox = viewport.getBoundingClientRect();
                const Y = e.clientY - cbox.top;
                const top = Y * (1 - img.naturalWidth / viewport.offsetWidth);
                const X = e.clientX - cbox.left;
                const left =
                  X * (1 - img.naturalHeight / viewport.offsetHeight);
                scrollcn.style.top = `${top}px`;
                scrollcn.style.left = `${left}px`;
                img.style.width = `${img.naturalWidth}px`;
                img.style.cursor = 'zoom-out';
              } else {
                scrollcn.style.top = '0';
                scrollcn.style.left = '0';
                img.style.width = `${viewport.offsetWidth}px`;
                img.style.cursor = 'zoom-in';
              }
            } else img.style.cursor = 'default';
          }

          break;
        }

        case 'dictkeyinput': {
          const input = elem as HTMLInputElement;
          input.select();
          break;
        }

        default:
          throw Error(`Unhandled atextHandler click event '${targ.type}'`);
      }
      break;
    }

    case 'dblclick': {
      if (ofClass(['sb'], es.target)) {
        // Get selected text
        const selob = window.getSelection();
        if (selob) {
          let searchtext = selob.toString();
          searchtext = cleanDoubleClickSelection(searchtext);
          const { module } = this.props as AtextProps;
          if (module && searchtext && !/^\s*$/.test(searchtext)) {
            G.Commands.search({ module, searchtext, type: 'SearchAnyWord' });
          }
        }
      }
      break;
    }

    case 'mouseover': {
      const targ = ofClass(
        ['cr', 'fn', 'sn', 'un', 'image-container'],
        es.target
      );
      if (targ === null) return;
      const props = this.props as AtextProps;
      const { isPinned, module, panelIndex: index, place: pl } = props;
      const { pin } = this.state as AtextStateType;
      const place = isPinned && pin ? pin.place : pl;
      const target = es.target as HTMLElement;
      const atext = es.currentTarget as HTMLElement;
      const type = module ? G.Tab[module].type : '';
      let popupParent: any = ofClass(['npopup'], target);
      popupParent = popupParent ? popupParent.element : null;
      const elem = targ.element;
      const p = getElementData(elem);
      const { title, type: ptype } = p;
      let okay;
      switch (targ.type) {
        case 'cr':
          if (p && place.crossrefs === 'notebox') {
            okay = scroll2Note(atext, `w${index}.footnote.${ptype}.${title}`);
          }
          break;

        case 'fn':
          // genbk fn are embedded in text
          if (!popupParent && type === C.GENBOOK) okay = null;
          else if (p && place.footnotes === 'notebox') {
            okay = scroll2Note(atext, `w${index}.footnote.${ptype}.${title}`);
          }
          break;

        case 'un':
          if (
            p &&
            place.usernotes === 'notebox' &&
            (type === C.BIBLE || type === C.COMMENTARY)
          ) {
            okay = scroll2Note(atext, `w${index}.footnote.${ptype}.${title}`);
          }
          break;

        case 'sn': {
          // Add elem's strong's classes to stylesheet for highlighting
          const classes = Array.from(elem.classList);
          classes.shift(); // remove sn base class
          classes
            .filter((c) => /^S_\w*\d+$/.test(c))
            .forEach((cls, xx) => {
              const x = xx > 2 ? 2 : xx;
              const sheet =
                document.styleSheets[document.styleSheets.length - 1];
              const i = sheet.cssRules.length;
              const matchingStrongs = getCSS(`.matchingStrongs${x} {`);
              if (matchingStrongs) {
                sheet.insertRule(
                  matchingStrongs.rule.cssText.replace(
                    `matchingStrongs${x}`,
                    cls
                  ),
                  i
                );
                AddedRules.push({ sheet, index: i });
              }
            });
          break;
        }

        case 'image-container': {
          okay = true;
          const img = elem.getElementsByTagName('img');
          if (
            img &&
            img.length &&
            window.getComputedStyle(img[0], null).cursor !== 'not-allowed'
          ) {
            if (img[0].offsetWidth < img[0].naturalWidth)
              img[0].style.cursor = 'zoom-in';
            else if (img[0].style.width) img[0].style.cursor = 'zoom-out';
            else img[0].style.cursor = '';
          }
          break;
        }

        default:
          throw Error(`Unhandled atextHandler mouseOver event '${targ.type}'`);
      }

      if (!okay) {
        // report the problem for debugging
        if (okay === false) {
          let msg = `w=${index}\nclass=${elem.className}`;
          if (p) {
            Object.entries(p).forEach((entry) => {
              const [m, val] = entry;
              msg += `\n${m}=${val || 'null'}`;
            });
          }
          log.warn(msg);
        }
        elem.style.cursor = okay === false ? 'help' : 'default';
      }
      break;
    }

    case 'mouseout': {
      const e = es as React.MouseEvent;
      // Remove any footnote hilighting
      const atext = es.currentTarget as HTMLElement;
      if (atext) {
        const nbc = atext.lastChild as HTMLElement;
        Array.from(nbc.getElementsByClassName('fnselected')).forEach((note) => {
          note.classList.remove('fnselected');
        });
      }

      // Remove any dynamically added Strong's classes from CSS stylesheet,
      // unless we're now over npopup
      const nowover = e.relatedTarget as HTMLElement | null;
      if (!nowover?.classList.contains('npopup')) {
        AddedRules.reverse().forEach((r) => {
          r.sheet.deleteRule(r.index);
        });
        AddedRules = [];
      }
      break;
    }

    case 'wheel': {
      const e = es as React.WheelEvent;
      const { isPinned, module } = this.props as AtextProps;
      if (isPinned && module) {
        const atext = es.currentTarget as HTMLElement;
        const { type } = G.Tab[module];
        if (atext && type !== C.DICTIONARY && !ofClass(['nbc'], es.target)) {
          aTextWheelScroll(e, atext, this);
        }
      }
      break;
    }

    case 'change': {
      const { xulswordState, panelIndex } = this.props as AtextProps;
      const origselect = ofClass(['origselect'], es.target);
      if (origselect) {
        const s = origselect.element.firstChild as
          | HTMLSelectElement
          | undefined;
        const module = s?.value;
        if (module) {
          xulswordState((prevState: typeof S.prefs.xulsword) => {
            const { ilModules } = clone(prevState);
            ilModules[panelIndex] = module;
            return { ilModules } as Partial<typeof S.prefs.xulsword>;
          });
        }
      }
      break;
    }

    default:
      throw Error(`Unhandled atextHandler event type '${es.type}'`);
  }
}

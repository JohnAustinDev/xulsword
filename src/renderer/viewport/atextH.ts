/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import C from '../../constant';
import {
  cleanDoubleClickSelection,
  getCSS,
  ofClass,
  sanitizeHTML,
} from '../../common';
import { getElementInfo } from '../../libswordElemInfo';
import G from '../rg';
import { scrollIntoView } from '../rutil';
import { aTextWheelScroll, getRefHTML } from './zversekey';

import { AtextStateType, LocationVKType } from '../../type';
import type Atext from './atext';
import type { AtextProps } from './atext';

let MatchingStrongs: {
  sheet: CSSStyleSheet;
  rule: CSSRule;
  index: number;
} | null;
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
          'listenlink',
          'versePerLineButton',
          'image-container',
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
      const p = getElementInfo(elem);
      switch (targ.type) {
        case 'cr':
        case 'crtwisty':
          if (!popupParent && module) {
            let row;
            let id;
            if (targ.type === 'cr' && p) {
              id = `w${index}.footnote.${p.type}.${p.nid}.${p.osisref}.${p.mod}`;
              row = document.getElementById(id);
            } else {
              const rowx = ofClass(['fnrow'], elem);
              if (rowx) row = rowx.element;
            }
            if (row) {
              row.classList.toggle('cropened');
              const col5 = ofClass('fncol5', row, 'descendant');
              if (col5) {
                const el = col5.element;
                const refs = el.dataset.reflist;
                const context: LocationVKType = {
                  book: (p && p.bk) || '',
                  chapter: (p && Number(p.ch)) || 0,
                  verse: (p && p.vs) || null,
                  v11n: null,
                };
                if (refs) {
                  let html;
                  if (row.classList.contains('cropened')) {
                    html = getRefHTML(refs, module, context, true, false);
                  } else {
                    html = getRefHTML(refs, module, context, false, false);
                  }
                  sanitizeHTML(el, html);
                }
              }
              if (id) scroll2Note(atext, id);
            }
          }
          break;

        case 'listenlink':
          if (p && p.mod && p.ch && p.bk) {
            /* TODO!
            XS_window.Player.version = p.mod;
            XS_window.Player.chapter = p.ch;
            XS_window.Player.book = p.bk;
            XS_window.beginAudioPlayer();
            */
          }
          break;

        case 'versePerLineButton':
          this.setState((prevState: AtextStateType) => {
            const { versePerLine } = prevState;
            return { versePerLine: !versePerLine };
          });
          break;

        case 'image-container': {
          const cont = elem;
          const imgs = cont.getElementsByTagName('img');
          if (imgs && imgs.length) {
            const img = imgs[0];
            const style = window.getComputedStyle(img, null);
            if (style.cursor !== 'not-allowed') {
              const cbox = cont.getBoundingClientRect();
              cont.style.width = `${Math.round(cbox.width)}px`;
              cont.style.height = `${Math.round(cbox.height)}px`;
              if (img.offsetWidth < img.naturalWidth)
                img.style.width = `${img.naturalWidth}px`;
              else img.style.width = '';
              if (img.offsetWidth < img.naturalWidth)
                img.style.cursor = 'zoom-in';
              else if (img.style.width) img.style.cursor = 'zoom-out';
              else img.style.cursor = '';
              const contMouseY = e.clientY - cbox.top;
              const imgMouseY =
                contMouseY * (img.offsetHeight / cont.offsetHeight);
              cont.scrollTop = imgMouseY - (1 / 2) * cont.offsetHeight;
              const contMouseX = e.clientX - cbox.left;
              const imgMouseX =
                contMouseX * (img.offsetWidth / cont.offsetWidth);
              cont.scrollLeft = imgMouseX - (1 / 2) * cont.offsetHeight;
            }
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
      const p = getElementInfo(elem);
      let okay;
      switch (targ.type) {
        case 'cr':
          if (p && place.crossrefs === 'notebox') {
            okay = scroll2Note(
              atext,
              `w${index}.footnote.${p.type}.${p.nid}.${p.osisref}.${p.mod}`
            );
          }
          break;

        case 'fn':
          // genbk fn are embedded in text
          if (!popupParent && type === C.GENBOOK) okay = null;
          else if (p && place.footnotes === 'notebox') {
            okay = scroll2Note(
              atext,
              `w${index}.footnote.${p.type}.${p.nid}.${p.osisref}.${p.mod}`
            );
          }
          break;

        case 'un':
          if (
            p &&
            place.usernotes === 'notebox' &&
            (type === C.BIBLE || type === C.COMMENTARY)
          ) {
            okay = scroll2Note(
              atext,
              `w${index}.footnote.${p.type}.${p.nid}.${p.osisref}.${p.mod}`
            );
          }
          break;

        case 'sn': {
          // Add elem's strong's classes to stylesheet for highlighting
          const classes = Array.from(elem.classList);
          classes.shift(); // remove sn base class
          classes.forEach((cls) => {
            if (/^S_\w*\d+$/.test(cls)) {
              const sheet =
                document.styleSheets[document.styleSheets.length - 1];
              const i = sheet.cssRules.length;
              if (!MatchingStrongs) {
                // Read from CSS stylesheet
                MatchingStrongs = getCSS('.matchingStrongs {');
              }
              if (MatchingStrongs) {
                sheet.insertRule(
                  MatchingStrongs.rule.cssText.replace('matchingStrongs', cls),
                  i
                );
                AddedRules.push({ sheet, index: i });
              }
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
          console.log(msg);
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

    // start dragging the notebox resizing bar?
    case 'mousedown': {
      const e = es as React.MouseEvent;
      const { noteBoxResizing } = this.state as AtextStateType;
      const targ = ofClass('bb', es.target);
      if (targ) {
        this.setState({ noteBoxResizing: [e.clientY, e.clientY] });
        return;
      }
      if (noteBoxResizing !== null) this.setState({ noteBoxResizing: null });
      break;
    }

    // notebox resize bar dragging...
    case 'mousemove': {
      const e = es as React.MouseEvent;
      const { noteBoxResizing } = this.state as AtextStateType;
      const { noteBoxHeight, maximizeNoteBox, noteboxBar } = this
        .props as AtextProps;
      if (noteBoxResizing) {
        const targ = ofClass('atext', es.target);
        if (targ) {
          e.stopPropagation();
          e.preventDefault();
          const { columns: clsx } = targ.element.dataset;
          const columns = Number(clsx);
          const hd = targ.element.firstChild as HTMLElement;

          if (maximizeNoteBox > 0) noteboxBar(e);

          const [initial] = noteBoxResizing;

          // moved above the top?
          // nbHeightToMouse = noteBoxHeight + initial - e.clientY
          // e.clientY = noteBoxHeight + initial - nbHeightAtMouse
          // so set e.clientY = noteBoxHeight + initial - stopHeight
          const height = noteBoxHeight + initial - e.clientY;
          let stopHeight =
            targ.element.offsetHeight -
            hd.offsetHeight +
            C.UI.Atext.bbTopMargin;
          if (columns === 1) stopHeight -= C.UI.Atext.bbSingleColTopMargin;
          if (height >= stopHeight + 5) {
            this.bbMouseUp(
              e,
              [initial, noteBoxHeight + initial - stopHeight],
              true
            );
          }

          // moved below the bottom?
          else if (height <= C.UI.Atext.bbBottomMargin - 5) {
            this.bbMouseUp(
              e,
              [initial, noteBoxHeight + initial - C.UI.Atext.bbBottomMargin],
              false
            );
          }

          // otherwise follow the mouse...
          else this.setState({ noteBoxResizing: [initial, e.clientY] });
        }
      }
      break;
    }

    case 'mouseleave': {
      const { noteBoxResizing } = this.state as AtextStateType;
      if (noteBoxResizing) {
        this.setState({ noteBoxResizing: null });
      }
      break;
    }
    default:
      throw Error(`Unhandled atextHandler event type '${es.type}'`);
  }
}

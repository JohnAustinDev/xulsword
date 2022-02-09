/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import C from '../../constant';
import { cleanDoubleClickSelection, getCSS, ofClass } from '../../common';
import { getElementInfo } from '../../libswordElemInfo';
import G from '../rg';
import { scrollIntoView } from '../rutil';
import { textChange, aTextWheelScroll } from './zversekey';

import type Atext from './atext';
import type { AtextProps, AtextState } from './atext';

let MatchingStrongs: { rule: CSSRule; sheet: number; index: number } | null;
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
  const props = this.props as AtextProps;
  const { isPinned, module, panelIndex: index, place } = props;
  const target = es.target as HTMLElement;
  const atext = es.currentTarget as HTMLElement;
  const type = module ? G.Tab[module].type : '';
  switch (es.type) {
    case 'click': {
      const e = es as React.MouseEvent;
      const targ = ofClass(
        [
          'cr',
          'crtwisty',
          'listenlink',
          'prevchaplink',
          'nextchaplink',
          'versePerLineButton',
          'image-container',
          'dictkeyinput',
        ],
        target
      );
      if (targ === null) return;
      e.preventDefault();
      let popupParent: any = ofClass(['npopup'], target);
      popupParent = popupParent ? popupParent.element : null;
      const elem = targ.element;
      const p = getElementInfo(elem);
      switch (targ.type) {
        case 'prevchaplink':
        case 'nextchaplink': {
          if (isPinned) {
            this.setState((prevState: AtextState) => {
              return textChange(atext, targ.type === 'nextchaplink', prevState);
            });
          }
          break;
        }

        case 'cr':
          if (!popupParent && p) {
            const id = `w${index}.footnote.${p.type}.${p.nid}.${p.osisref}.${p.mod}`;
            const cr = document.getElementById(id);
            if (cr) {
              cr.classList.toggle('cropened');
              scroll2Note(atext, id);
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
          atext.classList.toggle('verse-per-line');
          break;

        // Notebox cross-reference twisty toggle
        case 'crtwisty': {
          const row = ofClass(['fnrow'], elem);
          if (row) row.element.classList.toggle('cropened');
          break;
        }

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
        if (module && searchtext && !/^\s*$/.test(searchtext)) {
          G.Commands.search({ module, searchtext, type: 'SearchAnyWord' });
        }
      }
      break;
    }

    case 'mouseover': {
      const targ = ofClass(['cr', 'fn', 'sn', 'un', 'image-container'], target);
      if (targ === null) return;
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
      if (type !== C.DICTIONARY && !ofClass(['nbc'], target)) {
        if (isPinned) {
          const { mouseWheel: m } = this;
          m.atext = atext;
          m.count += Math.round(e.deltaY / 80);
          if (m.TO) window.clearTimeout(m.TO);
          m.TO = window.setTimeout(() => {
            aTextWheelScroll(this);
          }, C.UI.Atext.wheelScrollDelay);
        }
      }
      break;
    }

    // start dragging the notebox resizing bar?
    case 'mousedown': {
      const e = es as React.MouseEvent;
      const { noteBoxResizing } = this.state as AtextState;
      const targ = ofClass('bb', target);
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
      const { noteBoxResizing } = this.state as AtextState;
      const { noteBoxHeight, maximizeNoteBox, onMaximizeNoteBox } = this
        .props as AtextProps;
      if (noteBoxResizing) {
        const targ = ofClass('atext', target);
        if (targ) {
          e.stopPropagation();
          e.preventDefault();
          const { columns: clsx } = targ.element.dataset;
          const columns = Number(clsx);

          if (maximizeNoteBox > 0) onMaximizeNoteBox(e);

          const [initial] = noteBoxResizing;

          // moved above the top?
          // nbHeightToMouse = noteBoxHeight + initial - e.clientY
          // e.clientY = noteBoxHeight + initial - nbHeightAtMouse
          // so set e.clientY = noteBoxHeight + initial - stopHeight
          const height = noteBoxHeight + initial - e.clientY;
          let stopHeight =
            targ.element.clientHeight - C.UI.Atext.prevNextHeight;
          if (columns === 1) stopHeight -= C.UI.Atext.bbTopMargin;
          if (height >= stopHeight) {
            this.bbMouseUp(
              e,
              [initial, noteBoxHeight + initial - stopHeight + 5],
              true
            );
          }

          // moved below the bottom?
          else if (height <= C.UI.Atext.bbBottomMargin) {
            this.bbMouseUp(
              e,
              [
                initial,
                noteBoxHeight + initial - C.UI.Atext.bbBottomMargin - 5,
              ],
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
      const { noteBoxResizing } = this.state as AtextState;
      if (noteBoxResizing) {
        this.setState({ noteBoxResizing: null });
      }
      break;
    }
    default:
      throw Error(`Unhandled atextHandler event type '${es.type}'`);
  }
}
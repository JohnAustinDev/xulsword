/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import C from '../../constant';
import { cleanDoubleClickSelection, getCSS, ofClass } from '../../common';
import { getElementInfo } from '../../libswordElemInfo';
import G from '../rg';
import { textChange, wheelscroll } from './zversekey';

import type Atext from './atext';
import type { AtextProps, AtextState } from './atext';

let MatchingStrongs: any;
let AddedRules: any[] = [];

function scroll2Note(atext: HTMLElement, id: string) {
  Array.from(atext.getElementsByClassName('fnselected')).forEach((note) => {
    note.classList.remove('fnselected');
  });
  const note = document.getElementById(id);
  if (!note) return false;
  note.classList.add('fnselected');
  note.scrollIntoView();
  const vp = document.getElementById('main-viewport');
  if (vp) vp.scrollTop = 0; // fix scrollIntoView issue
  return true;
}

export default function handler(this: Atext, es: React.SyntheticEvent) {
  const props = this.props as AtextProps;
  const { isPinned, module, n, place } = props;
  const i = n - 1;
  const target = es.target as HTMLElement;
  const atext = es.currentTarget as HTMLElement;
  const type = module ? G.Tab[module].type : '';
  switch (es.type) {
    case 'click': {
      const e = es as React.MouseEvent;
      const targ = ofClass(
        [
          'cr',
          'gfn',
          'crtwisty',
          'snbut',
          'listenlink',
          'prevchaplink',
          'nextchaplink',
          'versePerLineButton',
          'image-container',
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
            const r = textChange(atext, targ.type === 'nextchaplink');
            if (r)
              this.setState((prevState: AtextState) => {
                const { pin } = prevState;
                const s = { pin: { ...pin, ...r } };
                return s;
              });
          }
          break;
        }

        case 'cr':
          if (!popupParent && p) {
            const id = `w${n}.footnote.${p.type}.${p.nid}.${p.osisref}.${p.mod}`;
            const cr = document.getElementById(id);
            if (cr) {
              cr.classList.toggle('cropened');
              scroll2Note(atext, id);
            }
          }
          break;

        case 'snbut':
          if (p && p.ch && p.mod)
            G.Commands.search(`lemma: ${p.ch}`, {
              module: p.mod,
              type: 'SearchAdvanced',
            });
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

        case 'gfn': {
          if (p && p.title) {
            let gfns;
            if (popupParent) gfns = [];
            // popup.npopupTX.getElementsByClassName('gfn');
            else gfns = atext.getElementsByClassName('gfn');
            Array.from(gfns).forEach((gfn: any) => {
              if (gfn !== elem && gfn.dataset.title === p.title)
                gfn.scrollIntoView();
            });
          }
          break;
        }

        case 'image-container': {
          const img = elem.getElementsByTagName('img');
          if (
            img &&
            img.length &&
            window.getComputedStyle(img[0], null).cursor !== 'not-allowed'
          ) {
            let scrollbox = elem.parentNode as HTMLElement | null;
            while (
              scrollbox &&
              scrollbox.scrollHeight <= scrollbox.clientHeight
            ) {
              scrollbox = scrollbox.parentNode as HTMLElement | null;
            }
            let mouseYinit;
            let mouseXinit;
            let sbox;
            if (scrollbox) {
              sbox = scrollbox.getBoundingClientRect();
              const scrollYinit = scrollbox.scrollTop;
              const scrollXinit = scrollbox.scrollLeft;
              mouseYinit =
                (e.clientY - sbox.top - (img[0].offsetTop - scrollYinit)) /
                img[0].offsetHeight;
              mouseXinit =
                (e.clientX - sbox.left - (img[0].offsetLeft - scrollXinit)) /
                img[0].offsetWidth;
            }

            if (img[0].offsetWidth < img[0].naturalWidth)
              img[0].style.width = `${img[0].naturalWidth}px`;
            else img[0].style.width = '';
            if (img[0].offsetWidth < img[0].naturalWidth)
              img[0].style.cursor = 'zoom-in';
            else if (img[0].style.width) img[0].style.cursor = 'zoom-out';
            else img[0].style.cursor = '';

            // scroll image to our click location
            if (
              scrollbox &&
              sbox &&
              mouseYinit !== undefined &&
              mouseXinit !== undefined
            ) {
              scrollbox.scrollTop =
                mouseYinit * img[0].offsetHeight -
                e.clientY +
                sbox.top +
                img[0].offsetTop;
              scrollbox.scrollLeft =
                mouseXinit * img[0].offsetWidth -
                e.clientX +
                sbox.left +
                img[0].offsetLeft;
            }
          }
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
        let sel = selob.toString();
        sel = cleanDoubleClickSelection(sel);
        if (sel && !/^\s*$/.test(sel)) {
          // Do a search for selected word in mod. Use cmd_xs_search because
          // its much faster than cmd_xs_searchForSelection and can be used
          // because our selection is only a single word.
          G.Commands.search(sel, { module, type: 'SearchAnyWord' });
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
              `w${n}.footnote.${p.type}.${p.nid}.${p.osisref}.${p.mod}`
            );
          }
          break;

        case 'fn':
          // genbk fn are embedded in text
          if (!popupParent && type === C.GENBOOK) okay = null;
          else if (p && place.footnotes === 'notebox') {
            okay = scroll2Note(
              atext,
              `w${n}.footnote.${p.type}.${p.nid}.${p.osisref}.${p.mod}`
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
              `w${n}.footnote.${p.type}.${p.nid}.${p.osisref}.${p.mod}`
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
              const index = sheet.cssRules.length;
              if (!MatchingStrongs) {
                // Read from CSS stylesheet
                MatchingStrongs = getCSS('.matchingStrongs {');
              }
              try {
                sheet.insertRule(
                  MatchingStrongs.rule.cssText.replace(
                    'matchingStrongs',
                    classes[i]
                  ),
                  index
                );
                AddedRules.push({ sheet, index });
              } catch (er) {
                console.log(`Strong's class insertion failed: '${cls}'`);
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
          let msg = `w=${n !== null ? n : 'null'}\nclass=${elem.className}`;
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
        for (let x = AddedRules.length - 1; x >= 0; x -= 1) {
          AddedRules[x].sheet.deleteRule(AddedRules[x].index);
        }
        AddedRules = [];
      }
      break;
    }

    case 'wheel': {
      const e = es as React.MouseEvent;
      if (type !== C.DICTIONARY && !ofClass(['nbc'], target)) {
        if (isPinned) {
          const { mouseWheel: m } = this;
          m.atext = atext;
          m.count += e.detail;
          if (m.TO) window.clearTimeout(m.TO);
          m.TO = window.setTimeout(() => {
            wheelscroll(this);
          }, 250);
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

          if (maximizeNoteBox > 0) onMaximizeNoteBox(e);

          const [initial] = noteBoxResizing;

          // moved above the top?
          const height = noteBoxHeight + initial - e.clientY;
          const stopHeight = targ.element.clientHeight - C.TextHeaderHeight;
          if (height >= stopHeight - C.TextBBTopMargin) {
            this.bbMouseUp(
              e,
              [
                initial,
                noteBoxHeight + initial - stopHeight + C.TextBBTopMargin + 5,
              ],
              true
            );
          }

          // moved below the bottom?
          if (height <= C.TextBBBottomMargin) {
            this.bbMouseUp(
              e,
              [initial, noteBoxHeight + initial - C.TextBBBottomMargin - 5],
              false
            );
          }

          // otherwise follow the mouse...
          this.setState({ noteBoxResizing: [initial, e.clientY] });
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

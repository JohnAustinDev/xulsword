/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { clone, ofClass, sanitizeHTML } from '../../common';
import G from '../rg';
import { getElementInfo, getPopupInfo } from '../../libswordElemInfo';
import { log, getContextModule } from '../rutil';
import { getDictEntryHTML, getLemmaHTML } from '../viewport/zdictionary';
import {
  getIntroductions,
  getNoteHTML,
  parseExtendedVKRef,
} from '../viewport/zversekey';

import { LocationVKType } from '../../type';
import type { ElemInfo } from '../../libswordElemInfo';
import type Popup from './popup';
import type { PopupState } from './popup';

export function getTopElement(
  elemhtml: string[] | null,
  eleminfo: ElemInfo[] | null
) {
  if (!elemhtml || !elemhtml.length) return null;
  const elemHTML = elemhtml[elemhtml.length - 1];
  const reninfo =
    eleminfo && eleminfo.length === elemhtml.length
      ? eleminfo[eleminfo.length - 1]
      : {};
  const div = sanitizeHTML(document.createElement('div'), elemHTML);
  const elem = div.firstChild as HTMLElement | null;
  if (!elem) throw Error(`Popup was given a malformed element: '${elemHTML}'`);
  const info = { ...getPopupInfo(elem), ...reninfo };
  if (!info)
    throw Error(
      `Neither Popup elemhtml or eleminfo provided info: '${elemHTML}'`
    );
  return { info, elem, elemHTML };
}

// Get html for Popup target with the help of any extra info.
export function getPopupHTML(
  elem: HTMLElement,
  info: ElemInfo,
  testonly?: boolean // is elem renderable as a popup?
) {
  const { type, reflist, bk, ch, mod, title } = info;
  let html = '';
  switch (type) {
    case 'cr':
    case 'fn':
    case 'un': {
      if (mod && bk && ch && title) {
        // getChapterText must be called before getNotes
        G.LibSword.getChapterText(mod, `${bk}.${ch}`);
        const notes = G.LibSword.getNotes();
        // a note element's title does not include type, but its nlist does
        html = getNoteHTML(notes, null, 0, !testonly, `${type}.${title}`);
      }
      break;
    }

    // An 'sr' class of reference is a textual link to either a scripture passage
    // or, in some weird cases (such as StrongsHebrew module) to a dictionary entry.
    case 'sr': {
      if (mod) {
        const bibleReflist = reflist
          ? reflist.join(';')
          : elem && elem.innerHTML;
        // Getting original context of an sr span is tricky since popup
        // copies the span locally. So write data-context when possible.
        let si = info;
        if (!si.vs) {
          let pp;
          if (elem.dataset.context) {
            pp = getElementInfo(
              `<span class="vs" data-title="${elem.dataset.context}">`
            );
          } else {
            const vstarg = ofClass(['vs'], elem);
            if (vstarg) {
              pp = getElementInfo(vstarg.element);
              if (pp) {
                const { bk: b, ch: c, vs: v, lv: l, mod: m } = pp;
                elem.dataset.context = `${b}.${c}.${v}.${l}.${m}`;
              }
            }
          }
          if (pp) si = pp;
        }
        const { bk: bk2, ch: ch2, vs: vs2 } = si;
        const context: LocationVKType = {
          book: bk2 || '',
          chapter: !Number.isNaN(Number(ch2)) ? Number(ch2) : 0,
          verse: vs2,
          v11n: null,
        };
        const parsed = parseExtendedVKRef(bibleReflist, context);
        if (parsed.length) {
          const { book, chapter, verse } = context;
          const dt = `cr.1.${book || 0}.${chapter || 0}.${verse || 0}.${mod}`;
          html = getNoteHTML(
            `<div class="nlist" data-title="${dt}">${bibleReflist}</div>`,
            null,
            0,
            !testonly
          );
        } else if (reflist && reflist[0]) {
          html = getDictEntryHTML(reflist[0].replace(/^.*?:/, ''), mod);
        }
      }
      break;
    }

    case 'sn': {
      const m = mod || getContextModule(elem.parentNode);
      if (m) {
        const snlist = Array.from(elem.classList);
        if (snlist && snlist.length > 1) {
          snlist.shift();
          html = getLemmaHTML(snlist, elem.innerHTML, m);
        }
      }
      break;
    }

    case 'dtl':
    case 'dt': {
      if (reflist) {
        const dnames: string[] = [];
        let dword = '';
        reflist.forEach((ref) => {
          if (ref) {
            const colon = ref.indexOf(':');
            if (colon !== -1) dnames.push(ref.substring(0, colon));
            if (!dword) dword = ref.substring(colon + 1);
          }
        });
        html = getDictEntryHTML(dword, dnames.join(';'));
      }
      break;
    }

    case 'introlink': {
      if (mod && bk && ch) {
        const intro = getIntroductions(mod, `${bk}.${ch}`);
        if (intro && intro.textHTML) html = intro.textHTML;
      }
      break;
    }

    case 'noticelink': {
      if (mod) html = G.LibSword.getModuleInformation(mod, 'NoticeText');
      break;
    }

    case 'unknown': {
      log.warn(`Unknown popup: '${elem.className}'`);
      break;
    }

    default:
      throw Error(`Unhandled popup type '${type}'.`);
  }
  return html;
}

export default function handler(this: Popup, e: React.MouseEvent) {
  const target = e.target as HTMLElement;
  switch (e.type) {
    case 'mouseover': {
      const targ = ofClass(
        [
          'npopup',
          'cr',
          'fn',
          'un',
          'sn',
          'sr',
          'dt',
          'dtl',
          'introlink',
          'noticelink',
        ],
        target
      );
      if (!targ || targ.type === 'npopup') return;
      if (!getPopupHTML(targ.element, getPopupInfo(targ.element), true)) {
        targ.element.classList.add('empty');
      }
      break;
    }

    case 'mousedown': {
      if (ofClass(['draghandle'], target)) {
        this.setState((prevState: PopupState) => {
          let { drag } = prevState;
          drag = clone(drag);
          if (!drag) return null;
          if (!drag.x[0]) drag.x[0] = e.clientX;
          if (!drag.y[0]) drag.y[0] = e.clientY;
          if (!drag.adjustment) drag.adjustment = 0;
          drag.x[1] = e.clientX;
          drag.y[1] = e.clientY;
          drag.dragging = true;
          return { drag };
        });
        e.preventDefault();
      }
      break;
    }

    case 'mousemove': {
      const { drag } = this.state as PopupState;
      if (!drag || !drag.dragging) return;
      this.setState((prevState: PopupState) => {
        let { drag: ndrag } = prevState;
        ndrag = clone(ndrag);
        if (!ndrag || !ndrag.dragging) return null;
        ndrag.x[1] = e.clientX;
        ndrag.y[1] = e.clientY;
        return { drag: ndrag };
      });
      e.preventDefault();
      break;
    }

    case 'mouseup': {
      const { drag } = this.state as PopupState;
      if (!drag || !drag.dragging) return;
      this.setState((prevState: PopupState) => {
        let { drag: ndrag } = prevState;
        ndrag = clone(ndrag);
        if (!ndrag || !ndrag.dragging) return null;
        ndrag.dragging = false;
        return { drag: ndrag };
      });
      break;
    }

    default:
      throw Error(`Unhandled popup event type: '${e.type}`);
  }
}

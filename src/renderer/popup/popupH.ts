/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { clone, ofClass, sanitizeHTML } from '../../common';
import C from '../../constant';
import G from '../rg';
import { getPopupInfo } from '../../libswordElemInfo';
import { getCompanionModules, getContextModule } from '../rutil';
import { getDictEntryHTML, getLemmaHTML } from '../viewport/zdictionary';
import { getIntroductions, getNoteHTML } from '../viewport/zversekey';

import type { ElemInfo } from '../../libswordElemInfo';
import type Popup from './popup';
import type { PopupState } from './popup';

export function getRefBible(
  mod: string | null,
  type: string | null
): string | null {
  let refbible = mod && G.Tab[mod].type === C.BIBLE ? mod : null;
  if (mod && !refbible && type === 'sr') {
    const aref = getCompanionModules(mod);
    const bible = aref.find((m) => G.Tab[m]?.type === C.BIBLE);
    if (bible) refbible = bible;
  }
  if (refbible && (type === 'cr' || type === 'sr')) {
    // default prefs.js doesn't have this key since mod is unknown
    refbible = (G.Prefs.getPrefOrCreate(
      `global.popup.selection.${mod}`,
      'string',
      refbible
    ) || refbible) as string;
  }
  return refbible;
}

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

export function getPopupHTML(elem: HTMLElement, info: ElemInfo) {
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
        html = getNoteHTML(
          notes,
          type === 'cr' ? getRefBible(mod, type) || mod : mod,
          null,
          0,
          true,
          `${type}.${title}`
        );
      }
      break;
    }

    // An 'sr' class of reference is a textual link to either a scripture passage
    // or, in some cases (such as StrongsHebrew module) to a dictionary entry.
    case 'sr': {
      if (mod) {
        const refbible = getRefBible(mod, type);
        if (refbible) {
          const mynote =
            reflist && reflist[0] !== 'unavailable'
              ? reflist.join(';')
              : elem.innerHTML;
          html = getNoteHTML(
            `<div class="nlist" data-title="cr.1.0.0.0.${refbible}">${mynote}</div>`,
            refbible,
            null,
            0,
            true
          );
        } else if (reflist && reflist[0]) {
          const key = reflist[0].replace(/^.*?:/, '');
          html = getDictEntryHTML(key, mod);
        }
      }
      break;
    }

    case 'sn': {
      if (mod) {
        const snlist = Array.from(elem.classList);
        if (snlist && snlist.length > 1) {
          snlist.shift();
          html = getLemmaHTML(snlist, elem.innerHTML, mod);
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
      console.log(`Unknown popup: '${elem.className}'`);
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
        ['cr', 'fn', 'un', 'sn', 'sr', 'dt', 'dtl', 'introlink', 'noticelink'],
        target
      );
      if (targ) {
        const info = getPopupInfo(targ.element);
        if (info && targ.type === 'sn')
          info.mod = getContextModule(targ.element.parentNode);
        if (!getPopupHTML(targ.element, info))
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

/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { clone, findBookmarkItem, ofClass } from '../../common';
import G from '../rg';
import { addBookmarksToNotes, getBookmarkInfo } from '../bookmarks';
import { getElementData } from '../htmlData';
import { getDictEntryHTML, getLemmaHTML } from '../viewport/zdictionary';
import {
  getIntroductions,
  getNoteHTML,
  parseExtendedVKRef,
} from '../viewport/zversekey';

import type { BookmarkFolderType } from '../../type';
import type { HTMLData } from '../htmlData';
import type Popup from './popup';
import type { PopupState } from './popup';

// Get html for Popup target with the help of any extra info.
export function getPopupHTML(
  data: HTMLData,
  testonly?: boolean // is elem renderable as a popup?
): string {
  const {
    type,
    className,
    context,
    reflist,
    location,
    title,
    bmitem,
    snphrase,
  } = data;
  let html = '';
  switch (type) {
    case 'cr':
    case 'fn': {
      if (location && title && context) {
        const { book, chapter } = location;
        // getChapterText must be called before getNotes
        G.LibSword.getChapterText(context, `${book}.${chapter}`);
        const notes = G.LibSword.getNotes();
        // a note element's title does not include type, but its nlist does
        html = getNoteHTML(notes, null, 0, !testonly, `${type}.${title}`);
      }
      break;
    }

    case 'un':
      if (bmitem && context) {
        const bm = findBookmarkItem(
          G.Prefs.getComplexValue(
            'manager.bookmarks',
            'bookmarks'
          ) as BookmarkFolderType,
          bmitem
        );
        const bmi = (bm && 'location' in bm && getBookmarkInfo(bm)) || null;
        if (bmi) {
          html = getNoteHTML(
            addBookmarksToNotes([bmi], '', context),
            null,
            0,
            !testonly
          );
        }
      }
      break;

    // An 'sr' class of reference is a textual link to either a versekey passage,
    // footnote, or, in some weird cases (such as StrongsHebrew module) to a
    // dictionary entry.
    case 'sr': {
      if (context && reflist && location) {
        const bibleReflist = reflist.join(';');
        const parsed = parseExtendedVKRef(bibleReflist, location);
        if (parsed.length) {
          const { book: b, chapter: c, verse: v } = location;
          const dt = `cr.1.${b || 0}.${c || 0}.${v || 0}.${context}`;
          html = getNoteHTML(
            `<div class="nlist" data-title="${dt}">${bibleReflist}</div>`,
            null,
            0,
            !testonly
          );
        } else if (reflist && reflist[0]) {
          html = getDictEntryHTML(reflist[0].replace(/^.*?:/, ''), context);
        }
      }
      break;
    }

    case 'sn': {
      if (context && className && snphrase) {
        const snlist = className.trim().split(' ');
        if (snlist && snlist.length > 1) {
          snlist.shift();
          html = getLemmaHTML(snlist, snphrase, context);
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
      if (context && location) {
        const { book, chapter } = location;
        const intro = getIntroductions(context, `${book}.${chapter}`);
        if (intro && intro.textHTML) html = intro.textHTML;
      }
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
        ['npopup', 'cr', 'fn', 'un', 'sn', 'sr', 'dt', 'dtl', 'introlink'],
        target
      );
      if (!targ || targ.type === 'npopup') return;
      if (!getPopupHTML(getElementData(targ.element), true)) {
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

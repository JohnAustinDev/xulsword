import {
  JSON_attrib_stringify,
  clone,
  findBookmarkItem,
  getSwordOptions,
  ofClass,
} from '../../../common.ts';
import parseExtendedVKRef from '../../../extrefParser.ts';
import type S from '../../../defaultPrefs.ts';
import { G, GI } from '../../G.ts';
import { eventHandled, isBlocked, moduleInfoHTML } from '../../common.ts';
import { addBookmarksToNotes, getBookmarkInfo } from '../../bookmarks.tsx';
import { getElementData } from '../../htmlData.ts';
import log from '../../log.ts';
import analytics from '../../analytics.ts';
import { getDictEntryHTML, getLemmaHTML } from '../atext/zdictionary.ts';
import { getIntroductions, getNoteHTML } from '../atext/zversekey.ts';

import type { HTMLData } from '../../htmlData.ts';
import type RenderPromise from '../../renderPromise.ts';
import type Popup from './popup.tsx';

export type FailReason = { requires: string[]; reason?: string };

export function getFailReasonHTML(
  failReason: FailReason,
  renderPromise: RenderPromise,
): string {
  const { reason, requires } = failReason;
  if (reason || requires.length) {
    const d = JSON_attrib_stringify({
      type: 'requiremod',
      reflist: requires,
    } as HTMLData);
    const classes = ['popup-fail'];
    if (reason) classes.push('reason');
    if (requires.length) classes.push('requires');
    return `
      <div class="${classes.join(' ')}">
        <div class="fail-reason">${reason ?? ''}</div>
        <div class="fail-requires">
          <span class="label">${GI.i18n.t(
            '',
            renderPromise,
            'module-required.message',
          )}</span>
          <div class="requiremod button" data-data="${d}">
            <div class="button-box">
              <div class="bp6-button">
                ${GI.i18n.t('', renderPromise, 'install.label')}
              </div>
            </div>
          </div>
        <div>
      </div>`;
  }
  return '';
}

// Get html for Popup target with the help of any extra info. If html
// cannot be generated, an object is returned with information about
// the reason.
export function getPopupHTML(
  data: HTMLData,
  renderPromise: RenderPromise,
  testonly?: boolean, // is elem renderable as a popup?
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
  const failReason: FailReason = { requires: [] };
  let html = '';
  switch (type) {
    case 'cr':
    case 'fn': {
      if (location && title && context) {
        if (context in G.Tab) {
          const { book, chapter } = location;
          const { notes } = GI.LibSword.getChapterText(
            { text: '', notes: '' },
            renderPromise,
            context,
            `${book}.${chapter}`,
            getSwordOptions(G, G.Tab[context].type),
          );
          // a note element's title does not include type, but its nlist does
          html = getNoteHTML(
            notes,
            null,
            0,
            !testonly,
            `${type}.${title}`,
            !testonly,
            renderPromise,
          );
        } else failReason.requires.push(context);
      }
      break;
    }

    case 'un':
      if (bmitem && context) {
        if (context in G.Tab) {
          const bm = findBookmarkItem(
            G.Prefs.getComplexValue(
              'rootfolder',
              'bookmarks',
            ) as typeof S.bookmarks.rootfolder,
            bmitem,
          );
          const bmi =
            (bm && 'location' in bm && getBookmarkInfo(bm, renderPromise)) ||
            null;
          if (bmi) {
            html = getNoteHTML(
              addBookmarksToNotes([bmi], '', context, renderPromise),
              null,
              0,
              !testonly,
              undefined,
              !testonly,
              renderPromise,
            );
          }
        } else failReason.requires.push(context);
      }
      break;

    // An 'sr' class of reference is a textual link to either a versekey passage,
    // footnote, or, in some weird cases (such as StrongsHebrew module) to a
    // dictionary entry.
    case 'sr': {
      if (context && reflist) {
        if (context in G.Tab) {
          const bibleReflist = reflist.join(';');
          const parsed = parseExtendedVKRef(
            bibleReflist,
            renderPromise,
            location,
            [],
          );
          if (parsed.length) {
            let b = 'Gen';
            let c = 0;
            let v = 0;
            if (location) {
              ({ book: b, chapter: c } = location);
              const { verse: vx } = location;
              v = vx || v;
            }
            const dt = `cr.1.${b}.${c}.${v}.${context}`;
            html = getNoteHTML(
              `<div class="nlist" data-title="${dt}">${bibleReflist}</div>`,
              null,
              0,
              !testonly,
              undefined,
              !testonly,
              renderPromise,
            );
          } else if (reflist?.[0]) {
            html = getDictEntryHTML(
              reflist[0].replace(/^.*?:/, ''),
              context,
              renderPromise,
              failReason,
            );
            analytics.record({
              event: 'glossary',
              module: context,
              locationky: reflist[0].replace(/^.*?:/, ''),
            });
          }
        } else failReason.requires.push(context);
      }
      break;
    }

    case 'sn': {
      if (context && className && snphrase) {
        if (context in G.Tab) {
          const snlist = className.trim().split(' ');
          if (snlist && snlist.length > 1) {
            snlist.shift();
            html = getLemmaHTML(
              snlist,
              snphrase,
              context,
              renderPromise,
              failReason,
            );
          }
        } else failReason.requires.push(context);
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
        html = getDictEntryHTML(
          dword,
          dnames.join(';'),
          renderPromise,
          failReason,
        );
        analytics.record({
          event: 'glossary',
          module: dnames.join(';'),
          locationky: dword,
        });
      }
      break;
    }

    case 'aboutlink': {
      if (context) {
        const conf = GI.getModuleConf(null, renderPromise, context);
        if (conf) {
          html = moduleInfoHTML([conf], renderPromise);
          analytics.record({
            event: 'glossary',
            module: context,
            locationky: 'aboutlink',
          });
        }
      }
      break;
    }

    case 'introlink': {
      if (context && location) {
        if (context in G.Tab) {
          const { book, chapter } = location;
          const intro = getIntroductions(
            context,
            `${book}.${chapter}`,
            renderPromise,
          );
          if (intro?.textHTML) {
            html = intro.textHTML;
            analytics.record({
              event: 'glossary',
              module: context,
              locationky: 'introlink',
            });
          }
        } else failReason.requires.push(context);
      }
      break;
    }

    default:
      throw Error(`Unhandled popup type '${type}'.`);
  }

  if (failReason) html += getFailReasonHTML(failReason, renderPromise);

  return html;
}

// Event handler for popup contents.
export default function handler(
  this: Popup,
  e: React.SyntheticEvent | PointerEvent,
) {
  if (isBlocked(e)) return;
  const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : (e as Event);
  const ep = nativeEvent instanceof PointerEvent ? nativeEvent : null;
  if (!ep) return;
  switch (ep.type) {
    case 'pointerenter': {
      const { target } = ep;
      const oc = ofClass(
        [
          'npopup',
          'cr',
          'fn',
          'un',
          'sn',
          'sr',
          'dt',
          'dtl',
          'aboutlink',
          'introlink',
        ],
        target,
      );
      if (!oc) return;
      const { element, type } = oc;
      if (!element) return;
      if (type === 'npopup') return;
      if (
        !getPopupHTML(getElementData(element), this.renderPromise, true) &&
        !this.renderPromise.waiting()
      ) {
        element.classList.add('empty');
        log.debug(
          `Popup failed without reported reason: ${element.classList.value}`,
        );
      }
      break;
    }

    case 'pointerdown': {
      if (ofClass(['draghandle'], ep.target)) {
        this.setState((prevState) => {
          let { drag } = prevState;
          drag = clone(drag);
          if (!drag) return null;
          if (!drag.x[0]) drag.x[0] = ep.clientX;
          if (!drag.y[0]) drag.y[0] = ep.clientY;
          if (!drag.adjustment) drag.adjustment = 0;
          drag.x[1] = ep.clientX;
          drag.y[1] = ep.clientY;
          drag.dragging = true;
          return { drag };
        });
        if (e.cancelable) e.preventDefault();
      }
      break;
    }

    case 'pointermove': {
      const { drag } = this.state;
      if (!drag || !drag.dragging) return;
      this.setState((prevState) => {
        let { drag: ndrag } = prevState;
        ndrag = clone(ndrag);
        if (!ndrag || !ndrag.dragging) return null;
        ndrag.x[1] = ep.clientX;
        ndrag.y[1] = ep.clientY;
        return { drag: ndrag };
      });
      if (e.cancelable) e.preventDefault();
      break;
    }

    case 'pointerleave':
    case 'pointerup': {
      const { drag } = this.state;
      if (!drag || !drag.dragging) return;
      this.setState((prevState) => {
        const { drag } = prevState;
        if (!drag || !drag.dragging) return null;
        return { drag: { ...drag, dragging: false } };
      });
      break;
    }

    default:
      if (Build.isDevelopment)
        log.warn(`Unhandled popup event type: '${ep.type}`);
      return;
  }

  eventHandled(e);
}

import C from '../../../constant.ts';
import type S from '../../../defaultPrefs.ts';
import VerseKey from '../../../verseKey.ts';
import {
  dString,
  getSwordOptions,
  JSON_attrib_stringify,
  ofClass,
} from '../../../common.ts';
import parseExtendedVKRef from '../../../extrefParser.ts';
import { getElementData } from '../../htmlData.ts';
import {
  getCompanionModules,
  getMaxChapter,
  getMaxVerse,
  getLocalizedChapterTerm,
  getExtRefHTML,
} from '../../common.ts';
import { G, GI } from '../../G.ts';
import { delayHandler } from '../libxul/xul.tsx';
import { getRootNode } from '../../rootNode.ts';
import {
  columnIsShowing,
  columnMetrics,
  columnOf,
  elementIsShowing,
  lastContentColumn,
  pageStart,
  scrollToColumn,
} from './zcolumns.ts';

import type {
  LocationVKType,
  LookupInfo,
  ScrollType,
  ShowType,
} from '../../../type.ts';
import type RenderPromise from '../../renderPromise.ts';
import type Xulsword from '../xulsword/xulsword.tsx';
import type { XulswordState } from '../xulsword/xulsword.tsx';
import type Atext from './atext.tsx';
import type { AtextPropsType, AtextStateType } from './atext.tsx';
import type { ColumnMetrics } from './zcolumns.ts';
import type ViewportWin from '../../app/viewportWin/viewportWin.tsx';
import type { ViewportWinState } from '../../app/viewportWin/viewportWin.tsx';

// Return an installed Bible module associated with a module of any type. If
// anyTypeModule is a Bible, it will be used, otherwise its Companion Bible.
// Then, if the user has specified another Bible module for it, the user module
// will be returned and userpref = true will be set in info. If no particular
// Bible reference can be found, null is returned.
export function getRefBible(
  anyTypeModule: string,
  renderPromise: RenderPromise,
  info?: Partial<LookupInfo>,
): string | null {
  const inf = typeof info === 'object' ? info : {};
  // Information collected during this search:
  inf.companion = false;
  inf.userpref = false;
  // Is mod a Bible?
  let refbible = anyTypeModule;
  if (!(refbible in G.Tab)) {
    // Allow case differences in module code references.
    const rblc = refbible.toLowerCase();
    refbible = Object.keys(G.Tab).find((m) => m.toLowerCase() === rblc) || '';
  }
  if (!(refbible in G.Tab) || G.Tab[refbible].type !== C.BIBLE) {
    refbible = '';
  }
  // Otherwise does mod have a Bible companion?
  if (!refbible) {
    const arefx = getCompanionModules(anyTypeModule, renderPromise);
    const aref = arefx
      .map((m) => {
        // Allow case differences in module code references.
        if (m in G.Tab) return m;
        const mlc = m.toLowerCase();
        return Object.keys(G.Tab).find((mx) => mx.toLowerCase() === mlc) || '';
      })
      .filter(Boolean);
    const bible = aref.find((m) => G.Tab[m]?.type === C.BIBLE);
    if (bible) {
      refbible = bible;
      inf.companion = true;
    }
  }
  // Finally, has the user specified a lookup for this module.
  const vklookup = G.Prefs.getComplexValue(
    'global.popup.vklookup',
  ) as typeof S.prefs.global.popup.vklookup;
  let userPrefBible = refbible;
  if (anyTypeModule in vklookup && vklookup[anyTypeModule]) {
    userPrefBible = vklookup[anyTypeModule];
  }
  if (userPrefBible !== refbible) {
    refbible = userPrefBible;
    inf.userpref = true;
  }
  return refbible || null;
}

// Returns the HTML needed to fill a note-box.
// The 'notes' argument is an HTML string of (typically) multiple notes.
// Each note is an 'nlist' div. A single note may be an extended cross-
// reference containing many individual cross-references. All cross-
// references are displayed in one of these possible ways:
// - Reference label only, for quick display, as required in browser mode.
// - Links only, requires server processing to parse reference labels and
//   determine link targets.
// - Links plus reference texts, requires even more server processing to
//   determine link targets plus locate installed modules capable of
//   suppling the reference text for each target. In browser mode, this
//   display should only be provided upon user request.
export function getNoteHTML(
  notes: string,
  show: Partial<ShowType> | null, // null to show all types of notes
  panelIndex = 0, // used for IDs
  openCRs = false, // show scripture reference texts or not
  keepOnlyThisNote = '', // type.title of a single note to keep
  vklookup = false, // use any user pref vkmod for versekey lookups
  renderPromise: RenderPromise,
) {
  if (!notes) return '';

  const index = panelIndex || 0; // w is only needed for unique id creation
  const containerTagsRE = /(^<div[^>]*>|<\/div>$)/g;

  // Remove any container around the nlist(s)
  let nlists = notes;
  if (!/^[^<]*<[^>]*class="nlist\b/.test(nlists)) {
    nlists = nlists.replace(containerTagsRE, '');
  }
  let note = nlists.split(/(?=<div[^>]+class="nlist")/);
  note = note.sort((a: string, b: string) => {
    const t1 = 'un';
    const t2 = 'fn';
    const t3 = 'cr';
    const ia = getElementData(a);
    const pa = ia?.location || null;
    const ib = getElementData(b);
    const pb = ib?.location || null;
    if (pa === null) return 1;
    if (pb === null) return -1;
    if (pa.chapter === pb.chapter) {
      if (pa.verse === pb.verse) {
        if (ia.type === ib.type) return 0;
        if (ia.type === t1) return -1;
        if (ia.type === t2 && ib.type === t3) return -1;
        return 1;
      }
      return (pa.verse || 0) > (pb.verse || 0) ? 1 : -1;
    }
    if ((pa.chapter || 0) < (pb.chapter || 0)) return -1;
    return 1;
  });

  // Start building our html
  let html = '';

  note.forEach((anote) => {
    const p = getElementData(anote);
    const { context, nid, location } = p;
    const { title: nlistTitle } = p;
    if (nlistTitle && nid) {
      // NOTE nlist title starts with fn|cr|un type, however other note related titles
      // do not!.
      let type: string | undefined = nlistTitle.substring(
        0,
        nlistTitle.indexOf('.'),
      );
      let book;
      let chapter;
      let verse;
      if (location) ({ book, chapter, verse } = location);
      const keepNote = (
        location
          ? [type, nid, book, chapter, verse, context]
          : [type, nid, 'unavailable', context]
      ).join('.');
      if (!keepOnlyThisNote || keepNote === keepOnlyThisNote) {
        const innerHtmlValue = anote.replace(containerTagsRE, '');
        // Check if this note should be displayed, and if not then skip it
        const notetypes = { fn: 'footnotes', cr: 'crossrefs', un: 'usernotes' };
        Object.entries(notetypes).forEach((entry) => {
          const [ntype, tx] = entry;
          if (type === ntype && show && !show[tx as keyof ShowType]) {
            type = undefined;
          }
        });
        if (type) {
          const fnid = `w${index}.footnote.${nlistTitle}`;
          const rowcls = openCRs ? ' cropened' : '';
          // Display this note as a row in the main table
          const fnrdata = JSON_attrib_stringify({
            type: 'fnrow',
            location,
            context,
          });
          html += `<div id="${fnid}" data-data="${fnrdata}" class="fnrow${rowcls}">`;

          // Write cell #1: an expander link for cross references only
          const twisty = type === 'cr' ? '<div class="crtwisty"></div>' : '';
          html += `<div class="fncol1">${twisty}</div>`;

          // These are the lines for showing expanded verse refs
          html += '<div class="fncol2"><div class="fndash"></div></div>';
          html += '<div class="fncol3">&nbsp;</div>';

          // Write cell #4: chapter and verse
          html += '<div class="fncol4">';
          if (chapter && verse) {
            const ch = dString(chapter);
            const vs = dString(verse);
            const fnldata = JSON_attrib_stringify({
              type: 'fnlink',
              location,
              context,
            });
            html += `<a class="fnlink" data-data="${fnldata}"><i>${ch}<bdi>:</bdi>${vs}</i></a> -`;
          }
          html += '</div>';

          // Write cell #5: note body
          const ccls = type === 'cr' ? ` data-reflist="${innerHtmlValue}"` : '';
          html += `<div class="fncol5"${ccls}>`;

          switch (type) {
            case 'cr': {
              if (location) {
                // If this is a cross reference, then parse the note body for references and display them
                if (Build.isWebApp && !openCRs) {
                  const vks = parseExtendedVKRef(
                    innerHtmlValue,
                    renderPromise,
                    location,
                  );
                  html += vks
                    .map((vk) =>
                      typeof vk === 'string'
                        ? vk
                        : new VerseKey(vk, renderPromise).readable(
                            G.i18n.language,
                            location.v11n,
                          ),
                    )
                    .join('; ');
                } else {
                  const keepNotes = false;
                  let tmod = /^[\w\d]+:/.test(innerHtmlValue)
                    ? innerHtmlValue.split(':')[0]
                    : context;
                  if (vklookup && context) {
                    const vklookup = G.Prefs.getComplexValue(
                      'global.popup.vklookup',
                    );
                    if (
                      vklookup &&
                      typeof vklookup === 'object' &&
                      context in vklookup
                    ) {
                      const usermod = (vklookup as any)[context];
                      if (usermod) tmod = usermod;
                    }
                  }
                  const locale =
                    (tmod &&
                      tmod in G.Config &&
                      G.Config[tmod].AssociatedLocale) ||
                    G.i18n.language;
                  html += getExtRefHTML(
                    G,
                    GI,
                    innerHtmlValue,
                    tmod || '',
                    locale,
                    location,
                    openCRs,
                    keepNotes,
                    renderPromise,
                  );
                }
              }
              break;
            }
            case 'fn': {
              // If this is a footnote, then just write the body
              let opdir = '';
              if (
                context &&
                G.Tab[context].direction !== G.ProgramConfig.direction
              ) {
                opdir = ' opposing-program-direction';
              }
              html += `<bdi><span class="fntext${opdir}">${innerHtmlValue}</span></bdi>`;
              break;
            }
            case 'un': {
              // If this is a usernote, then add direction entities and style
              html += `<bdi><span class="noteBoxUserNote">${innerHtmlValue}</span></bdi>`;
              break;
            }
            default:
          }

          // Finish this body and this row
          html += '</div>';
          html += '</div>';
        }
      }
    }
  });

  return html;
}

// Turns headings on before reading introductions
export function getIntroductions(
  mod: string,
  vkeytext: string,
  renderPromise?: RenderPromise,
) {
  if (!(mod in G.Tab) || !G.Tab[mod].isVerseKey) {
    return { textHTML: '', intronotes: '' };
  }

  const { text, notes } = GI.LibSword.getIntroductions(
    { text: '', notes: '' },
    renderPromise,
    mod,
    vkeytext,
    getSwordOptions(G, G.Tab[mod].type),
  );

  let intro = text;
  if (
    !intro ||
    intro.length < 10 ||
    /^\s*$/.test(intro.replace(/<[^>]*>/g, ''))
  )
    intro = '';

  return { textHTML: intro, intronotes: notes };
}

export function getChapterHeader(
  location: AtextPropsType['location'],
  module: AtextPropsType['module'],
  renderPromise: RenderPromise,
) {
  if (!location || !module) return { textHTML: '', intronotes: '' };
  const { book, chapter } = location;
  let l;
  if (module in G.Config) l = G.Config[module].AssociatedLocale;
  if (!l) l = G.i18n.language;
  const toptions = { lng: l, ns: 'books' };

  const intro = getIntroductions(module, `${book} ${chapter}`, renderPromise);

  const localizedBook = GI.i18n.t(book, renderPromise, book, toptions);
  const int = GI.i18n.t('', renderPromise, 'IntroLink', toptions);
  const localizedChapTerm = getLocalizedChapterTerm(
    book,
    chapter,
    l,
    renderPromise,
  );

  // Chapter heading has style of the locale associated with the module, or else
  // current program locale if no associated locale is installed.
  let html = `<div class="chapterhead${
    chapter === 1 ? ' chapterfirst' : ''
  } cs-${l}">`;
  html += '<div class="chaptitle" >';
  html += `<div class="chapbk">${localizedBook}</div>`;
  html += `<div class="chapch">${localizedChapTerm}</div>`;
  html += '</div>';

  const inc = !intro.textHTML ? ' empty' : '';
  const ind = JSON_attrib_stringify({
    type: 'introlink',
    location,
    context: module,
  });

  html += '<div class="chapinfo">';
  html += `<div class="introlink${inc}" data-data="${ind}">${int}</div>`;
  html += '</div>';

  html += '</div>';

  html += '<div class="head-line-break"></div>';

  html += `<div class="introtext${
    !intro.textHTML ? ' empty' : ''
  }" data-title="${[book, chapter, 1, module].join('.')}">${
    intro.textHTML ? intro.textHTML : ''
  }</div>`;

  return { textHTML: html, intronotes: intro.intronotes };
}

// Returns true if a scripture box is that of a commentary.
function isCommentary(sbe: Element): boolean {
  const { module } = sbe.parentElement?.dataset ?? {};
  return !!module && G.Tab[module].type === C.COMMENTARY;
}

// Returns true if v is a verse element which begins in the visible part of
// the scripture box, false otherwise.
function verseIsVisible(vx: Element): boolean {
  const v = vx as HTMLElement;
  // return false if we're not a verse
  if (!v?.classList?.contains('vs') || !('parentElement' in v)) return false;
  const sb = v.parentElement as HTMLElement;
  const atext = sb?.parentElement as HTMLElement;
  if (!sb || !atext || !atext.classList.contains('atext')) return false;
  const { module, columns: clx } = atext.dataset;
  const columns = Number(clx);
  if (!module) return false;
  const hd = sb.previousElementSibling as HTMLElement | null;

  // return false if we're not visible or being displayed
  const style = window.getComputedStyle(v);
  if (style.display === 'none' || style.visibility === 'hidden') return false;

  // are we a single column window?
  if (columns === 1) {
    return (
      v.offsetTop - sb.offsetTop >= sb.scrollTop &&
      v.offsetTop - sb.offsetTop <
        sb.scrollTop + sb.offsetHeight - (hd?.offsetHeight ?? 0)
    );
  }

  // multi-column windows: do we begin in a showing column?
  const m = columnMetrics(sb);
  const column = m && columnOf(sb, m, v);
  return !!m && column !== null && columnIsShowing(sb, m, column);
}

// Implement Atext verse scroll for single column panels. If the text has no
// such verse (not even within a verse range) it is left as it is, unless it
// is newText which was just written. Then its chapter start is shown.
export function versekeyScroll(
  sbe: HTMLElement,
  scrollProps: Pick<AtextPropsType, (typeof C.ScrollPropsVK)[number]>,
  newText: boolean,
) {
  const { module, location, scroll } = scrollProps;
  if (!location) return;
  const { book, chapter, verse } = location;
  if (!verse || scroll === undefined) return;

  sbe.scrollLeft = 0; // commentary may have been non-zero

  // find the element to scroll to
  let av = sbe.firstElementChild;
  let v = null as HTMLElement | null;
  let vf = null as HTMLElement | null;
  while (av && !v) {
    const pi = getElementData(av as HTMLElement);
    const p = pi?.location || null;
    if (p && pi.type === 'vs') {
      if (!vf && p.book === book && p.chapter === chapter) {
        vf = av as HTMLElement;
      }
      if (
        p.book === book &&
        p.chapter === chapter &&
        p.verse &&
        p.lastverse &&
        verse >= p.verse &&
        verse <= p.lastverse
      )
        v = av as HTMLElement;
    }
    av = av.nextElementSibling;
  }

  // if not found, new text uses first verse in current chapter
  if (!v && newText) v = vf;

  // if neither verse nor chapter has been found, return null
  if (!v) return;

  // perform appropriate scroll action
  let vOffsetTop = v.offsetTop;
  let vt: HTMLElement | null = v;
  while (vt && vt.parentElement !== v.offsetParent) {
    vt = vt.parentElement;
    if (vt?.offsetTop) vOffsetTop -= vt.offsetTop;
  }

  // some special rules for commentaries
  if (module && G.Tab[module].type === C.COMMENTARY) {
    // if part of commentary element is already visible, don't rescroll
    if (
      vOffsetTop < sbe.scrollTop &&
      vOffsetTop + v.offsetHeight > sbe.scrollTop + 20
    ) {
      return;
    }

    // commentaries should never scroll verse to middle, only to top
    if (scroll?.verseAt === 'center') scroll.verseAt = 'top';
  }
  // if this is verse 1 then center becomes top
  if (verse === 1 && scroll?.verseAt === 'center') scroll.verseAt = 'top';

  // scroll single column windows...
  switch (scroll?.verseAt) {
    // put selected verse at the top of the window or link
    case 'top': {
      if (verse === 1) sbe.scrollTop = 0;
      else sbe.scrollTop = vOffsetTop;
      break;
    }
    // put selected verse in the middle of the window or link
    case 'center': {
      const middle = Math.round(
        vOffsetTop - sbe.offsetHeight / 2 + v.offsetHeight / 2,
      );
      if (vOffsetTop < middle) {
        sbe.scrollTop = vOffsetTop;
      } else {
        sbe.scrollTop = middle;
      }
      break;
    }

    default:
      throw Error(`Unsupported single column scroll "${scroll?.verseAt}"`);
  }
}

// Implement Atext verse scroll for multi-column Bible and commentary panels,
// which page by scrolling horizontally just like multi-column general books.
// The column where the verse begins is scrolled to the start of the page, or
// the first page is shown if the verse is on it. Verse 1 is shown along with
// whatever precedes it in its chapter (the chapter heading and any images). If
// the verse is already showing, or the text has no such verse (not even within
// a verse range), nothing changes unless force is true.
export function multiColumnVerseScroll(
  sbe: HTMLElement,
  location: LocationVKType,
  force: boolean,
) {
  const m = columnMetrics(sbe);
  if (!m) return;
  const verse = location.verse || 1;
  const v = findVerseElement(sbe, location.chapter, verse);
  if (!v && !force) return;
  let column = (v && columnOf(sbe, m, v)) ?? 0;
  // The commentary on a verse may fill several pages, so its verse is showing
  // if any part of it is. But a Bible verse is showing if it begins on the page.
  const showing =
    v && isCommentary(sbe)
      ? elementIsShowing(sbe, m, v)
      : columnIsShowing(sbe, m, column);
  if (force || !showing) {
    if (verse === 1) {
      let e = v?.previousElementSibling;
      for (; e && !e.classList.contains('vs'); e = e.previousElementSibling) {
        column = columnOf(sbe, m, e) ?? column;
      }
    }
    scrollToColumn(sbe, m, column < m.columns ? 0 : column);
  }
}

// Returns true if the page of a multi-column Bible already shows a location,
// so that neither its text nor its page need change. A page turn leaves the
// location at the first verse which begins on the page, and that verse may be
// in another chapter than the first chapter of the text. But verse 1 which is
// to be at the top must be the first verse on the page, so that choosing a
// chapter shows that chapter from its start.
export function pageShowsLocation(
  sbe: HTMLElement,
  location: LocationVKType,
  scroll: ScrollType,
): boolean {
  const m = columnMetrics(sbe);
  if (!m) return false;
  const showing = (v: Element | null): boolean => {
    const column = v && columnOf(sbe, m, v);
    return typeof column === 'number' && columnIsShowing(sbe, m, column);
  };
  let first = sbe.firstElementChild;
  while (first && !(first.classList.contains('vs') && showing(first))) {
    first = first.nextElementSibling;
  }
  if (!first) return false;
  // The verse is inconsequential when scroll is null.
  if (!scroll) {
    return getElementData(first).location?.chapter === location.chapter;
  }
  const verse = location.verse || 1;
  const v = findVerseElement(sbe, location.chapter, verse);
  return verse === 1 && scroll.verseAt === 'top' ? v === first : showing(v);
}

function aTextWheelScroll2(
  atext: HTMLElement,
  prevState: XulswordState | ViewportWinState | AtextStateType,
  renderPromise: RenderPromise,
): Partial<XulswordState | ViewportWinState | AtextStateType> | null {
  const atextstate =
    'pin' in prevState ? prevState : (null as AtextStateType | null);
  const parentstate =
    'location' in prevState
      ? prevState
      : (null as XulswordState | ViewportWinState | null);
  const location = atextstate?.pin?.location || parentstate?.location;
  if (location) {
    // Wheel scroll allows default browser smooth scroll for a certain period
    // before updating verse state to the new top verse. (The multi-column
    // wheel turns pages instead; see viewportParentH.)
    const newloc = getScrollVerse(atext, renderPromise);
    if (newloc) {
      const scroll: ScrollType = { verseAt: 'top' };
      if (parentstate) {
        return {
          location: newloc,
          scroll,
        };
      }
      if (atextstate?.pin) {
        return {
          pin: {
            ...atextstate.pin,
            location: newloc,
            scroll,
          },
        };
      }
    }
  }
  return null;
}

// Returns the multi-column panel whose pages a wheel event with this target
// turns (see viewportParentH), or null if there is none. Noteboxes and popups
// scroll as usual.
export function wheelPagePanel(target: EventTarget | null): HTMLElement | null {
  const atext = ofClass(['atext'], target)?.element;
  if (!atext || ofClass(['nbc', 'npopup'], target)) return null;
  return Number(atext.dataset.columns) > 1 ? atext : null;
}

let WheelSteps = 0;
export function aTextWheelScroll(
  e: React.WheelEvent,
  atext: HTMLElement,
  caller: Xulsword | ViewportWin | Atext,
) {
  WheelSteps += Math.round(e.deltaY / 80);
  if (WheelSteps) {
    delayHandler(
      caller,
      () => {
        const { renderPromise } = caller;
        (caller as Xulsword).setState((prevState) => {
          const s = aTextWheelScroll2(atext, prevState, renderPromise);
          WheelSteps = 0;
          return s as XulswordState;
        });
      },
      [],
      C.UI.Atext.wheelScrollDelay,
      'wheelScrollTO',
    );
  }
}

export function getScrollVerse(
  atext: HTMLElement,
  renderPromise: RenderPromise,
): LocationVKType | null {
  const { module } = atext.dataset;
  if (module) {
    // get first verse which begins in window
    const [sb] = Array.from(atext.getElementsByClassName('sb'));
    let v = sb.firstElementChild;
    while (v && !verseIsVisible(v)) {
      v = v.nextElementSibling;
    }
    // The commentary on a verse may fill several pages. So if no verse begins
    // on the page of a multi-column commentary, the verse is the one which
    // continues there.
    const m = !v && isCommentary(sb) && columnMetrics(sb as HTMLElement);
    if (m) {
      v = sb.firstElementChild;
      while (
        v &&
        !(
          v.classList.contains('vs') &&
          elementIsShowing(sb as HTMLElement, m, v)
        )
      ) {
        v = v.nextElementSibling;
      }
    }
    if (v) {
      const p = getElementData(v);
      if (p.location) {
        // To prevent an extra xulsword render, convert this location into the
        // v11n of the xulsword location pref.
        const { location } = G.Prefs.getComplexValue(
          'xulsword',
        ) as typeof S.prefs.xulsword;
        return location
          ? new VerseKey(p.location, renderPromise).location(location.v11n)
          : p.location;
      }
    }
  }
  return null;
}

let ScrollOneTimeID = '';
export function highlight(
  sbe: HTMLElement,
  selection: LocationVKType | null,
  scroll: ScrollType,
  renderPromise: RenderPromise,
) {
  // First unhilight everything
  Array.from(sbe.getElementsByClassName('hl')).forEach((v) => {
    v.classList.remove('hl');
  });

  if (selection) {
    let { book, chapter, verse, lastverse } = selection;
    const atext = ofClass('atext', sbe);
    if (atext) {
      const { module } = atext.element.dataset;
      if (module) {
        const { v11n } = G.Tab[module];
        if (v11n) {
          ({ book, chapter, verse, lastverse } = new VerseKey(
            selection,
            renderPromise,
          ).location(v11n));
        }
      }
    }
    if (!renderPromise?.waiting()) {
      let sv = '';
      if (Build.isWebApp) {
        sv = 'sv';
        const oldsv = getRootNode().getElementById('sv');
        if (oldsv) oldsv.id = '';
      }
      if (verse) {
        const lv = lastverse || verse;
        // Then find the verse element(s) to highlight
        let av = sbe.firstElementChild;
        while (av) {
          const vi = getElementData(av);
          const { type, location } = vi;
          const v = location || null;
          if (v && type === 'vs') {
            let hi = v.book === book && v.chapter === chapter;
            if (
              !v.lastverse ||
              !v.verse ||
              v.lastverse < verse ||
              v.verse > lv
            ) {
              hi = false;
            }
            if (hi) {
              av.classList.add('hl');
              if (sv && !av.id) {
                av.id = sv;
                const elem = getRootNode().getElementById('sv');
                if (elem) {
                  // This was copied from atext.tsx. Not sure if it's still all
                  // needed in either place.
                  const { scrollIntoView } = scroll || {};
                  const { selector, oneTimeID } = scrollIntoView ?? {};
                  if (
                    selector &&
                    scrollIntoView &&
                    oneTimeID &&
                    ScrollOneTimeID !== oneTimeID
                  ) {
                    ScrollOneTimeID = oneTimeID;
                    setTimeout(() => elem.scrollIntoView(scrollIntoView), 100);
                  }
                }
                sv = '';
              }
            }
          }

          av = av.nextElementSibling;
        }
      }
    }
  }
}

// Returns whether each note of a multi-column scripture box has its marker on
// the showing page. Notes are keyed as their notebox row ids are, less the
// panel prefix.
function pageNoteMarkers(
  sbe: HTMLElement,
  m: ColumnMetrics,
): Map<string, boolean> {
  const types = ['fn', 'cr', 'un'];
  const onPage = new Map<string, boolean>();
  sbe.querySelectorAll<HTMLElement>('.fn, .cr, .un').forEach((e) => {
    const { title } = e.dataset;
    const type = types.find((t) => e.classList.contains(t));
    const column = columnOf(sbe, m, e);
    if (title && type && column !== null) {
      const key = `${type}.${title}`;
      onPage.set(key, onPage.get(key) || columnIsShowing(sbe, m, column));
    }
  });
  return onPage;
}

// Hide the notes of a notebox which don't belong to the showing text, and
// return true if any notes are left showing. A multi-column page may begin or
// end within a verse, so there a note shows if its marker is on the page.
// Otherwise (or if a note has no marker) a note shows if its verse begins in
// the showing text.
export function trimNotes(sbe: HTMLElement, nbe: HTMLElement): boolean {
  let havefn = false;
  const m = columnMetrics(sbe);
  const onPage = m ? pageNoteMarkers(sbe, m) : null;

  // get first chapter/verse
  let vf = sbe.firstElementChild;
  while (vf && !verseIsVisible(vf)) {
    vf = vf.nextElementSibling;
  }

  // get last chapter/verse
  let vl = sbe.lastElementChild;
  while (vl && !verseIsVisible(vl)) {
    vl = vl.previousElementSibling;
  }

  const fi = vf ? getElementData(vf) : null;
  const f = fi?.location || null;
  const li = vl ? getElementData(vl) : null;
  const l = li?.location || null;

  // hide footnotes whose references are scrolled off the window
  if (nbe.innerHTML) {
    const nt = Array.from(nbe.getElementsByClassName('fnrow')) as HTMLElement[];
    nt.forEach((nti) => {
      const markerOnPage = onPage?.get(nti.id.replace(/^w\d+\.footnote\./, ''));
      if (typeof markerOnPage === 'boolean') {
        nti.style.display = markerOnPage ? '' : 'none';
        if (markerOnPage) havefn = true;
        return;
      }
      const vi = getElementData(nti);
      const v = vi?.location || null;
      if (v) {
        // No verse begins in the window, so no verse notes are shown.
        let display = !f && !l ? 'none' : '';
        if (
          f &&
          v.chapter &&
          f.chapter &&
          v.verse &&
          f.verse &&
          (v.chapter < f.chapter ||
            (v.chapter === f.chapter && v.verse < f.verse))
        )
          display = 'none';
        if (
          l &&
          vl &&
          v.chapter &&
          l.chapter &&
          v.verse &&
          l.verse &&
          (v.chapter > l.chapter ||
            (v.chapter === l.chapter && v.verse > l.verse))
        )
          display = 'none';
        nti.style.display = display;
        if (display !== 'none') havefn = true;
      }
    });
  }

  return havefn;
}

export function findVerseElement(
  sbe: HTMLElement,
  chapter: number,
  verse: number,
): HTMLElement | null {
  let c = sbe.firstElementChild;
  while (c) {
    const hc = c as HTMLElement;
    if (c.classList?.contains('vs') && hc.dataset.title) {
      const [, ch, vs, lv] = hc.dataset.title.split('.');
      if (Number(ch) === chapter) {
        for (let x = Number(vs); x <= Number(lv); x += 1) {
          if (x === verse) return hc;
        }
      }
    }
    c = c.nextElementSibling;
  }
  return null;
}

// For versekey modules only. Change to a particular bk.ch or change
// the passed chapter by a delta if possible. Returns null if a requested
// change cannot be done with certainty. NOTE: This function currently
// returns changes between books as null, although this could be coded in.
export function chapterChange(
  location: LocationVKType | null,
  chDelta: number,
  renderPromise: RenderPromise,
): LocationVKType | null {
  if (!location?.v11n) return null;
  const { book } = location;
  let { chapter } = location;
  if (chDelta) chapter += chDelta;
  if (chapter < 1) return null;
  const maxchapter = getMaxChapter(location.v11n, location.book, renderPromise);
  if (!maxchapter || chapter > maxchapter) return null;
  location.book = book;
  location.chapter = chapter;
  location.verse = 1;
  return location;
}

// For versekey modules only. Change to a particular bk.ch.vs or change
// the passed verse by a delta if possible. Returns null if a requested
// change cannot be done with certainty.
export function verseChange(
  location: LocationVKType | null,
  vsDelta: number,
  renderPromise: RenderPromise,
): LocationVKType | null {
  if (!location) return null;
  let { book, chapter, verse } = location;
  const { v11n } = location;
  if (!verse || !v11n) return null;
  if (vsDelta) verse += vsDelta;
  const maxvs = getMaxVerse(v11n, [book, chapter].join('.'), renderPromise);
  let ps;
  if (verse < 1) {
    if (!vsDelta) return null;
    ps = chapterChange(location, -1, renderPromise);
    if (!ps) return null;
    verse = getMaxVerse(v11n, `${ps.book}.${ps.chapter}`, renderPromise);
    ({ book } = ps);
    ({ chapter } = ps);
  } else if (verse > maxvs) {
    if (!vsDelta) return null;
    ps = chapterChange(location, 1, renderPromise);
    if (!ps) return null;
    verse = 1;
    ({ book } = ps);
    ({ chapter } = ps);
  }
  return {
    book,
    chapter,
    verse,
    v11n,
  };
}

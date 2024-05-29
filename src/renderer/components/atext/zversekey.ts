/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable import/no-duplicates */
/* eslint-disable no-continue */
import C from '../../../constant.ts';
import S from '../../../defaultPrefs.ts';
import {
  dString,
  getSwordOptions,
  JSON_attrib_stringify,
} from '../../../common.ts';
import { getElementData, verseKey } from '../../htmlData.ts';
import { getCompanionModules, getMaxChapter, getMaxVerse, getLocalizedChapterTerm } from '../../rutil.ts';
import G, { GI } from '../../rg.ts';
import { delayHandler } from '../../libxul/xul.tsx';

import type {
  AtextPropsType,
  LocationVKType,
  LookupInfo,
  OSISBookType,
  ShowType,
} from '../../../type.ts';
import type RenderPromise from '../../renderPromise.ts';
import type Xulsword from '../xulsword/xulsword.tsx';
import type { XulswordState } from '../xulsword/xulsword.tsx';
import type Atext from './atext.tsx';
import type { AtextStateType } from './atext.tsx';
import type ViewportWin from '../../viewportWin/viewportWin.tsx';
import type { ViewportWinState } from '../../viewportWin/viewportWin.tsx';

// Return an installed Bible module associated with a module of any type. If
// anyTypeModule is a Bible, it will be used, otherwise its Companion Bible.
// Then, if the user has specified another Bible module for it, the user module
// will be returned and userpref = true will be set in info. If no particular
// Bible reference can be found, null is returned.
export function getRefBible(
  anyTypeModule: string,
  renderPromise: RenderPromise,
  info?: Partial<LookupInfo>
): string | null {
  const inf = (typeof info === 'object' ? info : {}) as Partial<LookupInfo>;
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
    'global.popup.vklookup'
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

// The 'notes' argument is an HTML string containing one or more nlist
// notes, possibly contained by a div. An nlist note contains a single
// verse-key textual note.
export function getNoteHTML(
  notes: string,
  show: Partial<ShowType> | null, // null to show all types of notes
  panelIndex = 0, // used for IDs
  openCRs = false, // show scripture reference texts or not
  keepOnlyThisNote = '', // type.title of a single note to keep
  renderPromise?: RenderPromise
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
        nlistTitle.indexOf('.')
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
        const innerHTML = anote.replace(containerTagsRE, '');
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
            const ch = dString(G.getLocaleDigits(), chapter, G.i18n.language);
            const vs = dString(G.getLocaleDigits(), verse, G.i18n.language);
            const fnldata = JSON_attrib_stringify({
              type: 'fnlink',
              location,
              context,
            });
            html += `<a class="fnlink" data-data="${fnldata}"><i>${ch}<bdi>:</bdi>${vs}</i></a> -`;
          }
          html += '</div>';

          // Write cell #5: note body
          const ccls = type === 'cr' ? ` data-reflist="${innerHTML}"` : '';
          html += `<div class="fncol5"${ccls}>`;

          switch (type) {
            case 'cr': {
              if (location) {
                // If this is a cross reference, then parse the note body for references and display them
                const info = {} as Partial<LookupInfo>;
                const keepNotes = false;
                const tmod = /^[\w\d]+:/.test(innerHTML)
                  ? innerHTML.split(':')[0]
                  : context;
                html += GI.getExtRefHTML(
                  '',
                  renderPromise,
                  innerHTML,
                  tmod || '',
                  location,
                  openCRs,
                  keepNotes,
                  info
                );
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
              html += `<bdi><span class="fntext${opdir}">${innerHTML}</span></bdi>`;
              break;
            }
            case 'un': {
              // If this is a usernote, then add direction entities and style
              html += `<bdi><span class="noteBoxUserNote">${innerHTML}</span></bdi>`;
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
    { text: '', notes: ''},
    renderPromise,
    mod,
    vkeytext,
    getSwordOptions(G, G.Tab[mod].type)
  )

  let intro = text;
  if (
    !intro ||
    intro.length < 10 ||
    /^\s*$/.test(intro.replace(/<[^>]*>/g, ''))
  )
    intro = '';

  return { textHTML: intro, intronotes: notes };
}

export function getChapterHeading(
  location: AtextPropsType['location'],
  module: AtextPropsType['module'],
  renderPromise?: RenderPromise,
) {
  if (!location || !module) return { textHTML: '', intronotes: '' };
  const { book, chapter } = location;
  const config = G.Config;
  let l;
  if (module in config) l = config[module].AssociatedLocale;
  if (!l) l = G.i18n.language;
  const toptions = { lng: l, ns: 'books' };

  const intro = getIntroductions(module, `${book} ${chapter}`, renderPromise);

  const localizedBook = GI.i18n.t(book, renderPromise, book, toptions);
  const int = GI.i18n.t('', renderPromise, 'IntroLink', toptions);
  const localizedChapTerm = getLocalizedChapterTerm(
    book,
    chapter,
    l,
    renderPromise
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

// Returns true if v is a visible verse element, false otherwise. If
// ignoreNotebox is true, v is considered visible even if it's behind
// the notebox (useful for multi-column scrolling to prevent notebox
// flashing).
function verseIsVisible(vx: Element, ignoreNotebox = false): boolean {
  const v = vx as HTMLElement;
  // return false if we're not a verse
  if (!v?.classList?.contains('vs') || !('parentElement' in v)) return false;
  const sb = v.parentElement as HTMLElement;
  const nbc = sb?.nextElementSibling as HTMLElement;
  const nb = nbc?.lastElementChild as HTMLElement;
  const atext = sb?.parentElement as HTMLElement;
  if (!sb || !nbc || !nb || !atext || !atext.classList.contains('atext'))
    return false;
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

  // multi-column windows...
  if (G.Config[module].direction === 'ltr') {
    // we are LTR
    // are we outside the visible columns?
    if (v.offsetLeft > sb.offsetWidth) return false;

    // are we in the last visible column but under the footnote box?
    const partialVerse = true;
    if (
      !ignoreNotebox &&
      v.offsetLeft > sb.offsetWidth - 1.1 * nb.offsetWidth &&
      v.offsetTop + (partialVerse ? 0 : v.offsetHeight) >
        atext.offsetHeight - nbc.offsetHeight - (hd?.offsetHeight ?? 0)
    ) {
      return false;
    }

    // then we must be visible
    return true;
  }

  // we are RTL
  // are we outside the visible columns?
  if (v.offsetLeft < 0) return false;

  // are we in the last visible column but under the footnote box?
  if (
    v.offsetLeft < 0.9 * nb.offsetWidth &&
    v.offsetTop + v.offsetHeight > atext.offsetHeight - nbc.offsetHeight
  ) {
    return false;
  }

  // then we must be visible
  return true;
}

// Implement Atext verse scroll for single column panels.
export function versekeyScroll(
  sbe: HTMLElement,
  scrollProps: Pick<AtextPropsType, typeof C.ScrollPropsVK[number]>
) {
  const { module, location, scroll } = scrollProps;
  if (!location) return;
  const { book, chapter, verse } = location;
  if (!verse || scroll === null || scroll === undefined) return;

  sbe.scrollLeft = 0; // commentary may have been non-zero

  // find the element to scroll to
  let av = sbe.firstElementChild as Element | null;
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

  // if not found, use first verse in current chapter
  if (!v) v = vf;

  // if neither verse nor chapter has been found, return null
  if (!v) return;

  // perform appropriate scroll action
  let vOffsetTop = v.offsetTop;
  let vt: HTMLElement | null = v;
  while (vt && vt.parentElement !== v.offsetParent) {
    vt = vt.parentElement;
    if (vt && vt.offsetTop) vOffsetTop -= vt.offsetTop;
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
    if (scroll.verseAt === 'center') scroll.verseAt = 'top';
  }
  // if this is verse 1 then center becomes top
  if (verse === 1 && scroll.verseAt === 'center') scroll.verseAt = 'top';

  // scroll single column windows...
  switch (scroll.verseAt) {
    // put selected verse at the top of the window or link
    case 'top': {
      if (verse === 1) sbe.scrollTop = 0;
      else sbe.scrollTop = vOffsetTop;
      break;
    }
    // put selected verse in the middle of the window or link
    case 'center': {
      const middle = Math.round(
        vOffsetTop - sbe.offsetHeight / 2 + v.offsetHeight / 2
      );
      if (vOffsetTop < middle) {
        sbe.scrollTop = vOffsetTop;
      } else {
        sbe.scrollTop = middle;
      }
      break;
    }

    default:
      throw Error(`Unsupported single column scroll "${scroll.verseAt}"`);
  }
}

function aTextWheelScroll2(
  count: number,
  atext: HTMLElement,
  prevState: XulswordState | ViewportWinState | AtextStateType,
  renderPromise?: RenderPromise
) {
  let ret:
    | Partial<XulswordState>
    | Partial<ViewportWinState>
    | Partial<AtextStateType>
    | null = null;
  const atextstate =
    'pin' in prevState ? prevState : (null as AtextStateType | null);
  const parentstate =
    'location' in prevState
      ? prevState
      : (null as XulswordState | ViewportWinState | null);
  const location = atextstate?.pin?.location || parentstate?.location;
  if (location) {
    const columns = Number(atext.dataset.columns);
    const { module } = atext.dataset;
    let newloc;
    // Multi-column wheel scroll simply adds a verse delta to verse state.
    if (columns > 1) newloc = verseChange(location, count, renderPromise);
    // Single-column wheel scroll allows default browser smooth scroll for
    // a certain period before updaing verse state to the new top verse.
    else {
      // get first verse which begins in window
      const sb = atext.getElementsByClassName('sb')[0];
      let v = sb.firstElementChild;
      while (v && !verseIsVisible(v)) {
        v = v.nextElementSibling;
      }
      if (!v) return null;
      const p = getElementData(v);
      const t = (module && G.Tab[module]) || null;
      const v11n = (t && t.v11n) || null;
      if (p.location && v11n) {
        const { book, chapter, verse } = p.location;
        if (book && chapter && verse) {
          newloc = verseKey({
              book: book as OSISBookType,
              chapter,
              verse,
              v11n,
            },
            undefined,
            undefined,
            renderPromise || null
          ).location(location.v11n);
        }
      }
    }
    if (newloc) {
      if (parentstate) {
        ret = {
          location: newloc,
          scroll: { verseAt: 'top' },
        };
      }
      if (atextstate?.pin) {
        ret = {
          pin: {
            ...atextstate.pin,
            location: newloc,
            scroll: { verseAt: 'top' },
          },
        };
      }
    }
  }
  return ret;
}

let WheelSteps = 0;
export function aTextWheelScroll(
  e: React.WheelEvent,
  atext: HTMLElement,
  caller: Xulsword | ViewportWin | Atext
) {
  WheelSteps += Math.round(e.deltaY / 80);
  if (WheelSteps) {
    const { columns } = atext.dataset;
    delayHandler.bind(caller)(
      () => {
        const { renderPromise } = caller;
        caller.setState(
          (prevState: XulswordState | ViewportWinState | AtextStateType) => {
            const s = aTextWheelScroll2(WheelSteps, atext, prevState, renderPromise);
            WheelSteps = 0;
            return s;
          }
        );
      },
      columns === '1'
        ? C.UI.Atext.wheelScrollDelay
        : C.UI.Atext.multiColWheelScrollDelay,
      'wheelScrollTO'
    )();
  }
}

export function highlight(
  sbe: HTMLElement,
  selection: LocationVKType,
  module: string,
  renderPromise: RenderPromise
) {
  // First unhilight everything
  Array.from(sbe.getElementsByClassName('hl')).forEach((v) => {
    v.classList.remove('hl');
  });

  if (!selection) return;
  const { book, chapter, verse, lastverse } = verseKey(
    selection,
    G.Tab[module].v11n || undefined,
    undefined,
    renderPromise || null
  ).location();
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
        if (!v.lastverse || !v.verse || v.lastverse < verse || v.verse > lv) {
          hi = false;
        }
        if (hi) av.classList.add('hl');
      }

      av = av.nextElementSibling;
    }
  }
}

export function trimNotes(sbe: HTMLElement, nbe: HTMLElement): boolean {
  let havefn = false;

  // get first chapter/verse
  let vf = sbe.firstElementChild;
  while (vf && !verseIsVisible(vf, true)) {
    vf = vf.nextElementSibling;
  }

  // get last chapter/verse
  const atext = sbe.parentElement as HTMLElement;
  const multicol = atext.dataset.columns !== '1';
  let vl = sbe.lastElementChild;
  while (vl && !verseIsVisible(vl, !multicol)) {
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
      const vi = getElementData(nti);
      const v = vi?.location || null;
      if (v) {
        let display = '';
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
  verse: number
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
  chDelta: number
): LocationVKType | null {
  if (!location || !location.v11n) return null;
  const { book } = location;
  let { chapter } = location;
  if (chDelta) chapter += chDelta;
  if (chapter < 1) return null;
  const maxchapter = getMaxChapter(location.v11n, location.book);
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
  renderPromise?: RenderPromise
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
    ps = chapterChange(location, -1);
    if (!ps) return null;
    verse = getMaxVerse(v11n, `${ps.book}.${ps.chapter}`, renderPromise);
    book = ps.book;
    chapter = ps.chapter;
  } else if (verse > maxvs) {
    if (!vsDelta) return null;
    ps = chapterChange(location, 1);
    if (!ps) return null;
    verse = 1;
    book = ps.book;
    chapter = ps.chapter;
  }
  return {
    book,
    chapter,
    verse,
    v11n,
  };
}

//
// Atext previous/next functions:
//

// For multi-column Bibles only.
export function pageChange(
  atext: HTMLElement,
  next: boolean,
  renderPromise?: RenderPromise
): LocationVKType | null {
  if (!next) {
    let firstVerse: HTMLElement | undefined;
    Array.from(atext.getElementsByClassName('vs')).forEach((v: any) => {
      if (!firstVerse && verseIsVisible(v)) firstVerse = v;
    });
    if (firstVerse) {
      const ei = getElementData(firstVerse);
      const { context, location } = ei;
      if (context && location) {
        const { book, chapter, verse } = location;
        const t = (context in G.Tab && G.Tab[context]) || null;
        if (t && book && (chapter !== 1 || verse !== 1)) {
          return {
            book,
            chapter,
            verse,
            v11n: t.v11n || null,
          };
        }
      }
    }
  } else {
    let lastVerse: HTMLElement | undefined;
    Array.from(atext.getElementsByClassName('vs'))
      .reverse()
      .forEach((v: any) => {
        if (!lastVerse && verseIsVisible(v)) lastVerse = v;
      });
    if (lastVerse) {
      const edata = getElementData(lastVerse);
      const { context, location } = edata;
      if (context && location) {
        const { book, chapter, verse } = location;
        const t = (context in G.Tab && G.Tab[context]) || null;
        const v11n = t?.v11n || null;
        if (v11n && book) {
          const vk = verseKey({
            book,
            chapter,
            verse,
            v11n,
          }, undefined, undefined, renderPromise || null);
          if (vk.chapter <= getMaxChapter(v11n, vk.osisRef())) {
            return vk.location();
          }
        }
      }
    }
  }
  return null;
}

/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable import/no-duplicates */
/* eslint-disable no-continue */
import C from '../../../constant.ts';
import S from '../../../defaultPrefs.ts';
import {
  clone,
  dString,
  getSwordOptions,
  JSON_attrib_stringify,
} from '../../../common.ts';
import { getElementData, verseKey } from '../../htmlData.ts';
import { getCompanionModules, getMaxChapter, getMaxVerse, getLocalizedChapterTerm } from '../../rutil.ts';
import RenderPromise, { trySyncOrPromise } from '../../renderPromise.ts';
import G from '../../rg.ts';
import { delayHandler } from '../xul.tsx';

import type {
  AtextPropsType,
  LocationVKType,
  LookupInfo,
  OSISBookType,
  ShowType,
  TabTypes,
  TextVKType,
} from '../../../type.ts';
import type { HTMLData } from '../../htmlData.ts';
import type Xulsword from '../../xulswordWin/xulsword.tsx';
import type { XulswordState } from '../../xulswordWin/xulsword.tsx';
import type Atext from './atext.tsx';
import type { AtextStateType } from './atext.tsx';
import type ViewportWin from '../../viewportWin/viewportWin.tsx';
import type { ViewportWinState } from '../../viewportWin/viewportWin.tsx';

// Return modules (optionally of a particular type) that are associated with
// the current locale and tab settings.
function workingModules(type?: TabTypes) {
  const am = G.ProgramConfig.AssociatedModules;
  const alternates = new Set(am ? am.split(',') : undefined);
  const tabs = G.Prefs.getComplexValue(
    'xulsword.tabs'
  ) as typeof S.prefs.xulsword.tabs;
  tabs.forEach((tbk) => {
    if (tbk) tbk.forEach((t) => alternates.add(t));
  });
  return Array.from(alternates).filter(
    (m) => !type || (m in G.Tab && G.Tab[m].tabType === type)
  );
}

// Return an installed Bible module associated with a module of any type. If
// anyTypeModule is a Bible, it will be used, otherwise its Companion Bible.
// Then, if the user has specified another Bible module for it, the user module
// will be returned and userpref = true will be set in info. If no particular
// Bible reference can be found, null is returned.
export function getRefBible(
  anyTypeModule: string,
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
    const arefx = getCompanionModules(anyTypeModule);
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

function getFootnoteText(location: LocationVKType, module: string): string {
  const { book, chapter, verse, subid } = location;
  if (subid) {
    const options = getSwordOptions(G, G.Tab[module].type);
    G.LibSword.getChapterText(module, `${book} ${chapter}`, options);
    const notes = G.LibSword.getNotes('getChapterText', [module, `${book} ${chapter}`, options])
      .split(/(?=<div[^>]+class="nlist")/);
    for (let x = 0; x < notes.length; x += 1) {
      const osisID = notes[x].match(/data-osisID="(.*?)"/); // getAttribute('data-osisID');
      if (osisID && osisID[1] === `${book}.${chapter}.${verse}!${subid}`) {
        return notes[x].replace(/(^<div[^>]+>|<\/div>$)/g, '');
      }
    }
  }
  return '';
}

// Given a LocationVKType and target module, this function attempts to return
// a TextVKType object using LibSword. Even if the target module is not an
// acceptable reference (because it's not a Bible or Commentary according to
// the commentary argument) or even if it is missing the referenced verses,
// alternate modules may be searched for the text (as long as location does
// not include a subid). First any companion modules are tried, unless
// altModules is set to false. Then altModules are searched in order. If still
// a text is not found, and findAny is set, then all tabs are searched in
// order. The returned text will also include textual notes if keepNotes is
// true. If no text was found (meaning a string longer than 7 characters since
// modules may use various empty verse place-holders) then null is returned.
// LookupInfo data is also returned via an info object if supplied.
export function locationVKText(
  locationx: LocationVKType,
  targetmodx: string | null,
  altModules?: string[] | null | false,
  keepNotesx?: boolean,
  commentaries?: boolean | 'only' | null | undefined,
  findAny?: boolean,
  info?: Partial<LookupInfo>
): TextVKType | null {
  const keepNotes = keepNotesx === undefined ? true : keepNotesx;
  const i = (typeof info === 'object' ? info : {}) as LookupInfo;
  // Information collected during this search:
  // i.companion = true should not be changed.
  i.alternate = false;
  i.anytab = false;
  i.possibleV11nMismatch = false;
  const tab = G.Tab;
  // Is module acceptable, or if not, is there a companion which is?
  let targetmod = targetmodx;
  if (targetmod && !(targetmod in tab)) {
    // Allow case differences in module code references.
    const targetmodlc = targetmod.toLowerCase();
    targetmod =
      Object.keys(tab).find((m) => m.toLowerCase() === targetmodlc) || null;
  }
  let location = locationx;
  const mtype = targetmod && targetmod in tab && tab[targetmod].type;
  const modOK =
    (mtype === C.BIBLE && commentaries !== 'only') ||
    (mtype === C.COMMENTARY && commentaries);
  if (!location.subid && targetmod && !modOK && altModules !== false) {
    const companions = getCompanionModules(targetmod);
    const compOK = companions.find((compx) => {
      let comp = compx;
      if (!(comp in tab)) {
        // Allow case differences in module code references.
        const complc = comp.toLowerCase();
        comp = Object.keys(tab).find((m) => m.toLowerCase() === complc) || '';
      }
      const ctype = comp && comp in tab && tab[comp].type;
      return (
        (ctype === C.BIBLE && commentaries !== 'only') ||
        (ctype === C.COMMENTARY && commentaries)
      );
    });
    const tov11n = compOK && tab[compOK].v11n;
    if (tov11n) {
      targetmod = compOK;
      location = verseKey(location).location(tov11n);
      i.companion = true;
    }
  }
  function tryText(loc: LocationVKType, mod: string): TextVKType | null {
    if (!mod || !(mod in tab)) return null;
    const { module, type, v11n } = tab[mod];
    const { book } = loc;
    const isOK =
      (type === C.BIBLE && commentaries !== 'only') ||
      (type === C.COMMENTARY && commentaries);
    if (isOK && v11n && book && G.getBooksInVKModule(module).includes(book)) {
      let text;
      const modloc = verseKey(loc);
      if (loc.subid) {
        text = getFootnoteText(loc, mod);
      } else {
        const options = getSwordOptions(G, G.Tab[module].type);
        text = G.LibSword.getVerseText(
          module,
          modloc.osisRef(v11n),
          keepNotes,
          options
        ).replace(/\n/g, ' ');
      }
      if (text && text.length > 7) {
        return {
          location: modloc.location(v11n),
          vkMod: module,
          text,
        };
      }
    }
    return null;
  }
  if (!location.v11n && targetmod && tab[targetmod]) {
    location.v11n = tab[targetmod].v11n || null;
  }
  let result = (targetmod && tryText(location, targetmod)) || null;
  if (!result && altModules && !location.subid) {
    altModules.forEach((m) => {
      if (!result) {
        result = tryText(location, m);
        if (result) {
          i.alternate = true;
          i.possibleV11nMismatch = !location.v11n;
        }
      }
    });
    if (!result && findAny) {
      G.Tabs.forEach((t) => {
        if (!result) {
          result = tryText(location, t.module);
          if (result) {
            i.anytab = true;
            i.possibleV11nMismatch = !location.v11n;
          }
        }
      });
    }
  }
  return result;
}

const NoterefRE = /^\s*([^!]+)!(.*?)\s*$/;

// This function tries to read a ";" separated list of Scripture
// references and returns an array of LocationVKType objects, one for
// each individual reference in the extended reference. It parses
// osisRef type references as well as free hand references which
// may include commas. It will supply missing book, chapter and verse
// values using previously read information (as is often required
// following commas). Initial context may be supplied using the
// context argument. Segments which fail to parse as Scripture
// references are silently ignored.
export function parseExtendedVKRef(
  extref: string,
  context?: LocationVKType,
  locales?: string[]
): (LocationVKType | string)[] {
  const reflistA = extref.split(/\s*;\s*/);
  for (let i = 0; i < reflistA.length; i += 1) {
    // Commas may be used to reference multiple verses, chapters, or ranges.
    // Whether a number or range is interpereted as verse or chapter depends
    // on context.
    const commas = reflistA[i].split(/\s*,\s*/);
    reflistA.splice(i, 1, ...commas);
    i += commas.length - 1;
  }
  const results: (LocationVKType | string)[] = [];
  let bk = (context?.book || '') as OSISBookType | '';
  let ch = context?.chapter || 0;
  let vs = context?.verse || 0;
  reflistA.forEach((r) => {
    let ref = r;
    let noteID;
    const noteref = ref.match(NoterefRE);
    if (noteref) {
      [, ref, noteID] = noteref;
    }
    const options = locales && locales.length ? { locales } : undefined;
    const vk = verseKey(ref, null, options);
    if (!vk.book && bk) {
      const match = ref
        .replace(/[^\s\p{L}\p{N}:-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .match(/^(\d+)(?:\s*:\s*(\d+))?(?:\s*-\s*(\d+))?/);
      if (match) {
        const [, chvs1, vrs, chvs2] = match;
        vk.book = bk;
        if (vrs) {
          // chapter:verse
          vk.chapter = Number(chvs1);
          vk.verse = Number(vrs);
          vk.lastverse = chvs2 ? Number(chvs2) : undefined;
        } else if (ch && vs) {
          // we're in verse context, so numbers are verses.
          vk.chapter = ch;
          vk.verse = Number(chvs1);
          vk.lastverse = chvs2 ? Number(chvs2) : undefined;
        } else {
          // we're in book or chapter context, so numbers are chapters.
          vk.chapter = Number(chvs1);
          vk.verse = undefined;
          vk.lastverse = undefined;
        }
      }
    }
    if (vk.book) {
      const location = vk.location();
      if (noteID) location.subid = noteID;
      results.push(location);
      bk = vk.book;
      ch = vk.chapter;
      vs = vk.verse || 0;
    } else {
      results.push(ref);
      // otherwise remove our context, since we may have missed something along the way
      bk = '';
      ch = 0;
      vs = 0;
    }
  });
  return results;
}

// Return an HTML Scripture reference list representing an extended reference.
// An extended reference is a textual reference comprising a list of Scripture
// references separated by semicolons and/or commas. If showText is false, only
// a list of reference links will be returned, without the contents of each
// reference.
export function getRefHTML(
  extref: string,
  targetmod: string,
  context: LocationVKType,
  showText?: boolean,
  keepNotes?: boolean,
  info?: Partial<LookupInfo>
): string {
  const locale =
    (targetmod in G.Config && G.Config[targetmod].AssociatedLocale) ||
    G.i18n.language;
  const list = parseExtendedVKRef(extref, context, [locale]);
  const alternates = workingModules();
  const mod = targetmod || alternates[0] || '';
  const html: string[] = [];
  list.forEach((locOrStr) => {
    let h = '';
    if (typeof locOrStr === 'string') {
      h += `
      <bdi>
        <span class="crref-miss">${locOrStr}</span>: ?
      </bdi>`;
    } else {
      const inf = typeof info === 'object' ? clone(info) : {};
      let resolve: TextVKType = {
        location: locOrStr,
        vkMod: mod,
        text: '',
      };
      if (showText || locOrStr.subid) {
        resolve =
          locationVKText(
            locOrStr,
            mod,
            alternates,
            keepNotes,
            false,
            true,
            inf
          ) || resolve;
      }
      const { location, vkMod: module, text } = resolve;
      if (module && module in G.Tab && location.book) {
        const { direction, label, labelClass } = G.Tab[module];
        const crref = ['crref'];
        const crtext = ['crtext'];
        if (direction !== G.ProgramConfig.direction) {
          crtext.push('opposing-program-direction');
        }
        const fntext = ['fntext'];
        if (direction !== G.ProgramConfig.direction) {
          fntext.push('opposing-program-direction');
        }
        const altlabel = ['altlabel', labelClass];
        const cc: (keyof LookupInfo)[] = ['alternate', 'anytab'];
        cc.forEach((c) => {
          if (inf[c]) altlabel.push(c);
        });
        const alt = cc.some((c) => inf[c])
          ? ` <bdi><span class="${altlabel.join(' ')}">(${label})</span></bdi>`
          : '';
        const crdata: HTMLData = { type: 'crref', location, context: module };
        const crd = JSON_attrib_stringify(crdata);
        const q = inf.possibleV11nMismatch
          ? '<span class="possibleV11nMismatch">?</span>'
          : '';
        h += `
          <bdi>
            <a class="${crref.join(' ')}" data-data="${crd}">
              ${verseKey(location).readable()}
            </a>
            ${q}${text ? ': ' : ''}
          </bdi>
          <bdi>
            <span class="${crtext.join(' ')}">${text}${alt}</span>
          </bdi>`;
      }
    }
    html.push(h);
  });
  return html.join('<span class="cr-sep"></span>');
}

// The 'notes' argument is an HTML string containing one or more nlist
// notes, possibly contained by a div. An nlist note contains a single
// verse-key textual note.
export function getNoteHTML(
  notes: string,
  show: Partial<ShowType> | null, // null to show all types of notes
  panelIndex = 0, // used for IDs
  openCRs = false, // show scripture reference texts or not
  keepOnlyThisNote = '' // type.title of a single note to keep
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
                html += getRefHTML(
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

  let intro: string, notes: string;
  const options = getSwordOptions(G, G.Tab[mod].type);
  const args = [mod, vkeytext, options] as Parameters<typeof G.LibSword.getIntroductions>;
  if (renderPromise) {
    [intro, notes] = trySyncOrPromise(G, renderPromise,
      [
        ['LibSword', 'getIntroductions', args],
        ['LibSword', 'getNotes', ['getIntroductions', args]]
      ],
      ['', '']
    ) as [string, string, string];
  } else {
    intro = G.LibSword.getIntroductions(args[0], args[1], args[2]);
    notes = G.LibSword.getNotes('getIntroductions', args);
  }

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
  let l = G.Config[module].AssociatedLocale;
  if (!l) l = G.i18n.language; // otherwise use current program locale
  const toptions = { lng: l, ns: 'books' };

  const intro = getIntroductions(module, `${book} ${chapter}`, renderPromise);

  let localizedBook: string, int: string;
  if (renderPromise) {
    [localizedBook, int] = trySyncOrPromise(G, renderPromise,
      [
        ['i18n', 't', [book, toptions]],
        ['i18n', 't', ['IntroLink', toptions]]
      ],
      [book, '']
    ) as [OSISBookType, string]
  } else {
    localizedBook = G.i18n.t(book, toptions);
    int = G.i18n.t('IntroLink', toptions);
  }

  const localizedChapTerm = getLocalizedChapterTerm(
    G.i18n,
    G.getLocaleDigits(true),
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
  prevState: XulswordState | ViewportWinState | AtextStateType
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
    if (columns > 1) newloc = verseChange(location, count);
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
          }).location(location.v11n);
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
        caller.setState(
          (prevState: XulswordState | ViewportWinState | AtextStateType) => {
            const s = aTextWheelScroll2(WheelSteps, atext, prevState);
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
  module: string
) {
  // First unhilight everything
  Array.from(sbe.getElementsByClassName('hl')).forEach((v) => {
    v.classList.remove('hl');
  });

  if (!selection) return;
  const { book, chapter, verse, lastverse } = verseKey(
    selection,
    G.Tab[module].v11n || undefined
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
  vsDelta: number
): LocationVKType | null {
  if (!location) return null;
  let { book, chapter, verse } = location;
  const { v11n } = location;
  if (!verse || !v11n) return null;
  if (vsDelta) verse += vsDelta;
  const maxvs = getMaxVerse(v11n, [book, chapter].join('.'));
  let ps;
  if (verse < 1) {
    if (!vsDelta) return null;
    ps = chapterChange(location, -1);
    if (!ps) return null;
    verse = getMaxVerse(v11n, `${ps.book}.${ps.chapter}`);
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
      const ei = getElementData(lastVerse);
      const { context, location } = ei;
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
          });
          if (vk.chapter <= getMaxChapter(v11n, vk.osisRef())) {
            const maxv = getMaxVerse(v11n, vk.osisRef(), renderPromise);
            if (!vk.verse || vk.verse <= maxv) return vk.location();
          }
        }
      }
    }
  }
  return null;
}

import { JSON_attrib_stringify, clone, getSwordOptions } from '../common.ts';
import parseExtendedVKRef from '../extrefParser.ts';
import C from '../constant.ts';
import verseKey, { verseKeyCommon } from './verseKey.ts';

import type S from '../defaultPrefs.ts';
import type {
  GITypeMain,
  GType,
  LocationVKType,
  LookupInfo,
  ParamShift,
  TabTypes,
  TextVKType,
  V11nType,
} from '../type.ts';
import type { RefParserOptionsType } from '../refParser.ts';
import type { HTMLData } from '../clients/htmlData.ts';
import type RenderPromise from '../clients/renderPromise.ts';

// Return an HTML Scripture reference list representing an extended reference.
// An extended reference is a textual reference comprising a list of Scripture
// references separated by semicolons and/or commas. If showText is false, only
// a list of reference links will be returned, without the contents of each
// reference.
export type GetExtRefHTML = (
  ...args: ParamShift<Parameters<typeof getExtRefHTML>>
) => ReturnType<typeof getExtRefHTML>;
export function getExtRefHTML(
  G: GType | GITypeMain,
  extref: string,
  targetmod: string,
  locale: string,
  context: LocationVKType,
  showText: boolean,
  keepNotes: boolean,
  info?: Partial<LookupInfo>,
): string {
  const list = parseExtendedVKRef(verseKeyCommon, extref, context, [locale]);
  const alternates = workingModules(G, locale);
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
            G,
            locOrStr,
            mod,
            alternates,
            keepNotes,
            false,
            true,
            inf,
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
        const cc: Array<keyof LookupInfo> = ['alternate', 'anytab'];
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
              ${verseKey(location).readable(locale)}
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
export type LocationVKText = (
  ...args: ParamShift<Parameters<typeof locationVKText>>
) => ReturnType<typeof locationVKText>;
export function locationVKText(
  G: GType | GITypeMain,
  locationx: LocationVKType,
  targetmodx: string | null,
  altModules?: string[] | null | false,
  keepNotesx?: boolean,
  commentaries?: boolean | 'only' | null | undefined,
  findAny?: boolean,
  info?: Partial<LookupInfo>,
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
    const companions: string[] = [];
    const companion = G.LibSword.getModuleInformation(targetmod, 'Companion');
    if (companion !== C.NOTFOUND)
      companions.push(...companion.split(/\s*,\s*/));
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
        text = getFootnoteText(G, loc, mod);
      } else {
        const options = getSwordOptions(
          'Prefs' in G ? G : false,
          G.Tab[module].type,
        );
        text = G.LibSword.getVerseText(
          module,
          modloc.osisRef(v11n),
          keepNotes,
          options,
        );
        text = text.replace(/\n/g, ' ');
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
  return result || null;
}

function getFootnoteText(
  G: GType | GITypeMain,
  location: LocationVKType,
  module: string,
): string {
  const { book, chapter, verse, subid } = location;
  if (subid) {
    const { notes: n } = G.LibSword.getChapterText(
      module,
      `${book} ${chapter}`,
      getSwordOptions('Prefs' in G ? G : false, G.Tab[module].type),
    );
    const notes = n.split(/(?=<div[^>]+class="nlist")/);
    for (let x = 0; x < notes.length; x += 1) {
      const osisID = notes[x].match(/data-osisID="(.*?)"/); // getAttribute('data-osisID');
      if (osisID && osisID[1] === `${book}.${chapter}.${verse}!${subid}`) {
        return notes[x].replace(/(^<div[^>]+>|<\/div>$)/g, '');
      }
    }
  }
  return '';
}

// Return modules (optionally of a particular type) that are associated with
// the current locale and tab settings.
function workingModules(
  G: GType | GITypeMain,
  locale: string,
  type?: TabTypes,
) {
  const am = G.LocaleConfigs[locale].AssociatedModules;
  const alternates = new Set(am ? am.split(',') : undefined);
  if ('Prefs' in G) {
    const tabs = G.Prefs.getComplexValue(
      'xulsword.tabs',
    ) as typeof S.prefs.xulsword.tabs;
    tabs.forEach((tbk) => {
      if (tbk) tbk.forEach((t) => alternates.add(t));
    });
  }
  return Array.from(alternates).filter(
    (m) => !type || (m in G.Tab && G.Tab[m].tabType === type),
  );
}

import { getSwordOptions } from '../common.ts';
import C from '../constant.ts';
import verseKey from './verseKey.ts';

import type {
  GITypeMain,
  GType,
  LocationVKType,
  LookupInfo,
  ParamShift,
  TextVKType,
} from '../type.ts';

// Given one or more LocationVKType objects and target module, this function
// attempts to return a TextVKType object using LibSword. Even if the target
// module is not an acceptable reference (because it's not a Bible or
// Commentary according to the commentary argument) or even if it is missing
// the referenced verses, alternate modules may be searched for the text (as
// long as location does not include a subid). First any companion modules are
// tried, unless altModules is set to false. Then altModules are searched in
// order. If still a text is not found, and findAny is set, then all tabs are
// searched in order. The returned text will also include textual notes if
// keepNotes is true. If no text was found (meaning a string longer than 7
// characters since modules may use various empty verse place-holders) then
// null is returned.
export type LocationVKTextG = (
  ...args: ParamShift<Parameters<typeof locationVKText>>
) => ReturnType<typeof locationVKText>;
export function locationVKText(
  G: GType | GITypeMain,
  locationx: (LocationVKType | null)[],
  targetmodx: string | null,
  altModules?: string[] | null | false,
  keepNotesx?: boolean,
  commentaries?: boolean | 'only' | null | undefined,
  findAny?: boolean,
  info?: Partial<LookupInfo>,
): ([TextVKType, LookupInfo] | null)[] {
  const keepNotes = keepNotesx === undefined ? true : keepNotesx;
  return locationx.map((l) => {
    if (l === null) return null;
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
    let location = l;
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
    return result ? [result, i] : null;
  });
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

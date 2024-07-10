import type { LocationVKType, OSISBookType } from './type';
import type RenderPromise from './renderer/renderPromise';
import type { verseKey } from './renderer/htmlData';

// This function tries to read a ";" separated list of Scripture
// references and returns an array of LocationVKType objects, one for
// each individual reference in the extended reference. It parses
// osisRef type references as well as free hand references which
// may include commas. It will supply missing book, chapter and verse
// values using previously read information (as is often required
// following commas). Initial context may be supplied using the
// context argument. Segments which fail to parse as Scripture
// references are silently ignored.
export default function parseExtendedVKRef(
  verseKeyFunc: typeof verseKey,
  extref: string,
  context?: LocationVKType,
  locales?: string[],
  renderPromise?: RenderPromise,
): Array<LocationVKType | string> {
  const NoterefRE = /^\s*([^!]+)!(.*?)\s*$/;
  const reflistA = extref.split(/\s*;\s*/);
  for (let i = 0; i < reflistA.length; i += 1) {
    // Commas may be used to reference multiple verses, chapters, or ranges.
    // Whether a number or range is interpereted as verse or chapter depends
    // on context.
    const commas = reflistA[i].split(/\s*,\s*/);
    reflistA.splice(i, 1, ...commas);
    i += commas.length - 1;
  }
  const results: Array<LocationVKType | string> = [];
  let bk = (context?.book || '') as OSISBookType | '';
  let ch = context?.chapter || 0;
  let vs = context?.verse || 0;
  const v11n = context?.v11n || null;
  reflistA.forEach((r) => {
    let ref = r;
    let noteID;
    const noteref = ref.match(NoterefRE);
    if (noteref) {
      [, ref, noteID] = noteref;
    }
    const options = locales?.length ? { locales } : undefined;
    const vk = verseKeyFunc(ref, v11n, options, renderPromise || null);
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

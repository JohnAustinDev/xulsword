import C from './constant';
import { GType } from './type';

export function escapeRE(text: string) {
  // eslint-disable-next-line no-useless-escape
  const ESCAPE_RE = /([\-\[\]\(\)\{\}\=\!\+\*\.\:\^\$\?\|\/\\])/g;
  return text.replace(ESCAPE_RE, '\\$1');
}

// Returns the number of a given short book name
export function findBookNum(bText: string | null, G: GType): number | null {
  let retv = null;
  for (let b = 0; typeof G.Book !== 'undefined' && b < G.Book.length; b += 1) {
    if (G.Book[b].sName === bText) {
      retv = b;
    }
  }
  return retv;
}

export function getModuleLongType(aModule: string, G: GType): string | null {
  if (aModule === C.ORIGINAL) return C.BIBLE;
  const typeRE = new RegExp(
    `(^|<nx>)\\s*${escapeRE(aModule)}\\s*;\\s*(.*?)\\s*(<nx>|$)`
  );
  const moduleList = G.LibSword.getModuleList();
  const m = moduleList.match(typeRE);
  let type;
  if (m !== null) [, , type] = m;
  else type = null;

  return type;
}

export function getAvailableBooks(version: string, G: GType) {
  if (G.cache.availableBooks === undefined) {
    G.cache.availableBooks = [];
  }
  if (!(version in G.cache.availableBooks)) {
    G.cache.availableBooks[version] = [];
    const type = getModuleLongType(version, G);
    if (type !== C.BIBLE && type !== C.COMMENTARY) return null;
    for (let b = 0; b < G.Book.length; b += 1) {
      if (type === C.BIBLE) {
        const v1 = G.LibSword.getVerseText(
          version,
          `${G.Book[b].sName} 1:1`,
          false
        );
        const v2 = G.LibSword.getVerseText(
          version,
          `${G.Book[b].sName} 1:2`,
          false
        );
        if ((v1 && !v1.match(/^\s*-\s*$/)) || (v2 && !v2.match(/^\s*-\s*$/))) {
          G.cache.availableBooks[version].push(G.Book[b].sName);
        }
      }
    }
  }

  return G.cache.availableBooks[version];
}

/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-bitwise */
/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
import i18n from 'i18next';
import { getElementInfo } from '../../libswordElemInfo';
import { dString, escapeRE, getCSS, sanitizeHTML } from '../../common';
import C from '../../constant';
import G from '../rg';
import { log, verseKey, windowArgument } from '../rutil';
import { getStrongsModAndKey } from '../viewport/zdictionary';

import type {
  GlobalPrefType,
  LocationVKType,
  SearchType,
  V11nType,
} from '../../type';
import type { SearchWinState } from './search';
import type SearchWin from './search';

export type SearchMatchType = {
  term: string;
  type: 'string' | 'RegExp' | null;
};

const libSwordSearchTypes = {
  REGEX: 0,
  PHRASE: -1,
  MULTIWORD: -2,
  ENTRY_ATTRIBUTE: -3,
  LUCENE: -4,
  COMPOUND: -5,
};

export const searchArg = windowArgument('search') as SearchType;

export function getLuceneSearchText(searchtext0: string) {
  let searchtext = searchtext0;
  Object.entries(C.UI.Search.symbol).forEach((entry) => {
    const k = entry[0];
    const [uiVal, luceneVal] = entry[1];
    let uiVal2 = uiVal;
    if (i18n.exists(k)) {
      const kv = i18n.t(k);
      if (!/^\s*$/.test(kv)) uiVal2 = kv;
    }
    searchtext = searchtext.replace(
      new RegExp(escapeRE(uiVal2), 'g'),
      luceneVal
    );
  });
  searchtext = searchtext.replace(/^\s*/, '');
  searchtext = searchtext.replace(/\s*$/, '');
  searchtext = searchtext.replace(/\s+/g, ' ');
  return searchtext;
}

function scopeBooks(scope: string, module?: string) {
  let books: string[] = [];
  if (!scope && module) {
    books = G.getBooksInModule(module);
  } else {
    scope.split(/\s+/).forEach((seg) => {
      const bk = seg.split('-');
      const beg = bk[0] in G.Book ? G.Book[bk[0]].index : 0;
      const end =
        bk.length === 2 && bk[1] in G.Book ? G.Book[bk[1]].index : beg;
      for (let i = beg; i <= end; i += 1) {
        books.push(G.Books[i].code);
      }
    });
  }
  return books;
}

function fullScope(module?: string) {
  if (module && module in G.Tab && G.Tab[module].isVerseKey) {
    const books = G.getBooksInModule(module);
    let first = G.Book.Gen.index;
    let last = G.Book.Rev.index;
    books.forEach((bk) => {
      if (G.Book[bk].index < first) first = G.Book[bk].index;
      if (G.Book[bk].index > last) last = G.Book[bk].index;
    });
    return `${G.Books[first].code}-${G.Books[last].code}`;
  }
  return 'Gen-Rev';
}

export async function search(sthis: SearchWin) {
  const state = sthis.state as SearchWinState;
  const { module, displayBible: db } = state;
  let { searchtype } = state;
  if (state.progress !== 0) return false;
  if (!/\S\S/.test(state.searchtext)) return false;
  if (!module) return false;

  const hasIndex = G.LibSword.luceneEnabled(module);
  const isBible = G.Tab[module].type === C.BIBLE;
  const displayBible = isBible ? module : db;

  if (!hasIndex && /lemma:/.test(state.searchtext)) {
    return createSearchIndex(sthis, module);
  }

  const s: Partial<SearchWinState> = {
    count: 0,
    pageindex: 0,
    progress: hasIndex ? 0 : 0.01,
    progressLabel: '',
    displayBible,
  };
  sthis.setState(s);

  // TODO!: Change window title to new search

  // Replace UI search symbols with Clucene recognized search symbols,
  // and prepare the query string according to search type.
  let searchtext = getLuceneSearchText(state.searchtext);

  let libSwordSearchType = libSwordSearchTypes.REGEX;
  if (G.LibSword.luceneEnabled(module)) {
    libSwordSearchType = libSwordSearchTypes.LUCENE;

    // If Lucene special operators are present, always search advanced.
    if (
      searchtext.search(
        /(\+|-|&&|\|\||!|\(|\)|{|}|\[|\]|\^|"|~|\*|\?|:|\\|AND|OR|NOT)/
      ) !== -1
    ) {
      searchtype = 'SearchAdvanced';
      s.searchtype = searchtype;
    }

    switch (searchtype) {
      case 'SearchAnyWord':
        searchtext = searchtext.replace(/ /gm, ' AND ');
        break;

      case 'SearchSimilar':
        searchtext = searchtext.replace(/\s*$/, '~');
        searchtext = searchtext.replace(/ /gm, '~ AND ');
        break;

      case 'SearchExactText':
        // MULTIWORD and REGEX ARE CASE SENSETIVE! So use REGEX.
        libSwordSearchType = libSwordSearchTypes.REGEX;
        break;

      default:
    }
  } else {
    // no Lucene
    searchtype = 'SearchExactText';
    s.searchtype = searchtype;
  }

  // Prepare the search scope (empty-string for non-versekey modules or search-all)
  let scope = '';
  if (G.Tab[module].type === C.BIBLE || G.Tab[module].type === C.COMMENTARY) {
    const { scoperadio, scopeselect } = state;
    const location = G.Prefs.getComplexValue(
      'xulsword.location'
    ) as GlobalPrefType['xulsword']['location'];
    const values = {
      all: fullScope(module),
      ot: 'Gen-Mal',
      nt: 'Matt-Rev',
      book: location?.book ?? 'Gen',
      other: 'other',
    };
    scope = values[scoperadio];
    if (scope === 'other') {
      if (scopeselect === 'custom') {
        scope = searchArg?.scope ?? '';
      } else if (i18n.exists(`search.${scopeselect}.books`)) {
        scope = i18n.t(`search.${scopeselect}.books`);
      }
    }
    if (/^\s*$/.test(scope)) scope = fullScope(module);
  }

  // get Search flags
  // BUG NOTE: FLAGS = 2 DOESNT WORK FOR NON-ENGLISH/NON-LUCENE SEARCHES
  let flags = 2; // Turn "Ignore Case" flag on.
  if (searchtype === 'SearchSimilar' || /~/.test(searchtext)) {
    flags |= 2048; // Turn on Sort By Relevance flag
  }

  // There are two different methods of searching: search piecemeal
  // book by book with progress bar, or, search the entire scope using
  // Clucene without showing any progress bar.
  if (
    libSwordSearchType !== libSwordSearchTypes.LUCENE &&
    (G.Tab[module].type === C.BIBLE || G.Tab[module].type === C.COMMENTARY)
  ) {
    // get array of books to search from scope param
    // example Scope=Gen Ps.0-Ps.150 Matt-Rev
    // NOTE: scope params must be in KJV book order!
    sthis.setState(s);
    s.count = await slowSearch(
      sthis,
      module,
      searchtext,
      scope,
      libSwordSearchType,
      flags
    );
    sthis.setState(s);
  } else {
    s.count = await G.LibSword.search(
      module,
      searchtext,
      scope,
      libSwordSearchType,
      flags,
      true
    );
    sthis.setState(s);
  }

  return true;
}

async function slowSearch(
  sthis: SearchWin,
  module: string,
  searchtext: string,
  scope: string,
  libswordSearchType: number,
  flags: number
): Promise<number> {
  const books = scopeBooks(scope, module);
  let isnew = true;
  const funcs = books.map((bk, i) => {
    return async () => {
      const count = await G.LibSword.search(
        module,
        searchtext,
        bk,
        libswordSearchType,
        flags,
        isnew
      );
      isnew = false;
      const s: Partial<SearchWinState> = {
        progress: i / books.length,
        progressLabel: G.Book[bk].name,
      };
      sthis.setState(s);
      return count;
    };
  });
  let grandTotal = 0;
  for (const func of funcs) {
    grandTotal = await func();
  }
  return grandTotal;
}

function createSearchIndex(sthis: SearchWin, module: string) {
  G.Window.modal('darkened', 'all');
  const s: Partial<SearchWinState> = {
    count: 0,
    pageindex: 0,
    progress: -1,
    progressLabel: i18n.t('BuildingIndex'),
  };
  sthis.setState(s);
  if (G.LibSword.luceneEnabled(module)) {
    G.LibSword.searchIndexDelete(module);
  }
  // The timeout allows UI to catch up before indexing begins,
  // which is still required even though indexing is anync.
  setTimeout(() => {
    G.LibSword.searchIndexBuild(module)
      .then(() => {
        G.Window.modal('off', 'all');
        sthis.setState({ progress: 0 });
        return search(sthis);
      })
      .catch((er: Error) => {
        log.error(er);
        G.Window.modal('off', 'all');
      });
  }, 100);
}

export function formatResult(div: HTMLDivElement, state: SearchWinState) {
  const { module, displayBible, searchtext, searchtype } = state;
  const dModule = G.Tab[module].type === C.BIBLE ? displayBible : module;
  Array.from(div.getElementsByClassName('slist')).forEach((slist) => {
    const p = getElementInfo(slist as HTMLElement);

    // Add the reference link to each result
    const span = document.createElement('span');
    span.innerHTML = '-';
    slist.insertBefore(span, slist.firstChild);
    const a = document.createElement('a');
    slist.insertBefore(a, slist.firstChild);
    const type = (p?.mod && G.Tab[p.mod].type) || C.BIBLE;
    switch (type) {
      case C.BIBLE:
      case C.COMMENTARY: {
        if (a && p?.osisref) {
          // Translate from module to DisplayBible
          const vsys = G.LibSword.getVerseSystem(module);
          const v = verseKey(p.osisref, vsys);
          sanitizeHTML(a, v.readable(G.LibSword.getVerseSystem(dModule)));
          a.className = 'cs-locale';
          a.id = ['verselink', vsys, v.osisRef()].join('.');
        }
        break;
      }

      case C.GENBOOK:
      case C.DICTIONARY: {
        if (p?.ch && p?.mod) {
          sanitizeHTML(a, p.ch.toString());
          a.className = `cs-${p.mod}`;
          // p.ch may contain . so careful using split('.')!
          a.id = ['keylink', p.mod, p.ch].join('.');
        }
        break;
      }
      default:
    }

    // Apply hilight class to search result matches
    const lastChild = slist.lastChild as HTMLElement;
    sanitizeHTML(
      lastChild,
      markSearchMatches(
        lastChild.innerHTML,
        getSearchMatches(searchtext, searchtype)
      )
    );
  });
}

function markSearchMatches(
  htmlStr: string,
  matches: SearchMatchType[]
): string {
  let html = htmlStr;
  matches.forEach((m) => {
    if (m.type === 'RegExp') {
      const re = new RegExp(m.term, 'gim');
      html = html
        .split(/(<[^>]*>)/)
        .map((t) => {
          if (/^<[^>]*>$/.test(t)) return t;
          return t.replace(re, '$1<span class="searchterm">$2</span>$3');
        })
        .join('');
    } else if (m.type === 'string') {
      const re = new RegExp(escapeRE(m.term), 'gim');
      html = html
        .split(/(<[^>]*>)/)
        .map((t) => {
          if (/^<[^>]*>$/.test(t)) return t;
          return t.replace(re, '<span class="searchterm">$&</span>');
        })
        .join('');
    }
  });

  return html.replace(/<br[^>]*>/g, ''); // since <br> looks bad in display
}

// To highlight results, build regular expressions for matching them.
function getSearchMatches(
  searchtext: string,
  searchtype: SearchWinState['searchtype']
) {
  let matches: SearchMatchType[] = [];
  let t = getLuceneSearchText(searchtext);
  switch (searchtype) {
    case 'SearchAnyWord':
    case 'SearchSimilar':
      // change spaces into ";" for later splitting
      t = t.replace(/ +/g, ';');
      matches = getMatchTermsArray(t);
      break;

    case 'SearchExactText':
      matches = [{ term: t, type: 'string' }];
      break;

    case 'SearchAdvanced': {
      t = t.replace(/ +/g, ';');
      t = t.replace(
        /(\+|-|&&|\|\||!|\(|\)|{|}|\[|\]|\^|~|:|"|\\|AND;|OR;|NOT;)/g,
        ''
      ); // Remove all control chars except [?";*]
      t = t.replace(/\?/g, '.'); // add dots before any ?s
      t = t.replace(/\*/g, '.*?'); // add dots before any *s

      // Change ";"s which are between quotes back into spaces, and remove the quotes
      let quoted = false;
      let rt = '';
      for (let x = 0; x < t.length; x += 1) {
        const mychr = t.charAt(x);
        if (mychr === '"') {
          quoted = !quoted;
        } else if (quoted && mychr === ';') {
          // \\s+ allows for more than one space between words in the striped text (common thing)
          rt += '\\s+';
        } else {
          rt += mychr;
        }
      }
      matches = getMatchTermsArray(rt);
      break;
    }
    default:
  }

  function getMatchTermsArray(terms: string): SearchMatchType[] {
    const tr: SearchMatchType[] = [];
    terms.split(';').forEach((term) => {
      if (!/lemma:/.test(term)) {
        const aTerm: SearchMatchType = { term: '', type: null };
        // Begin and End cannot be \W because non-English letters ARE \W!
        aTerm.term = `(^|\\s|–|\\(|>)(${term})(<|\\s|\\.|\\?|,|;|:|"|!|\\)|$)`;
        aTerm.type = 'RegExp';
        tr.push(aTerm);
      }
    });
    return tr;
  }

  return matches;
}

export const strongsCSS = {
  css: getCSS('.matchingStrongs {'),
  sheet: document.styleSheets[document.styleSheets.length - 1],
  added: [] as number[],
};

export function hilightStrongs(strongs: RegExpMatchArray | null) {
  strongs?.forEach((s) => {
    const c = `S_${s.replace(/lemma:\s*/, '')}`;
    const index = strongsCSS.sheet.cssRules.length;
    if (strongsCSS.css) {
      strongsCSS.sheet.insertRule(
        strongsCSS.css.rule.cssText.replace('matchingStrongs', c),
        index
      );
      strongsCSS.added.push(index);
    }
  });
}

export function lexicon(lexdiv: HTMLDivElement, state: SearchWinState) {
  const { searchtext, searchtype, module, displayBible, count } = state;
  const dModule = G.Tab[module].type === C.BIBLE ? displayBible : module;
  const strongs: RegExpMatchArray | null = searchtext.match(/lemma:\s*\S+/g);

  lexdiv.style.display = 'none'; // might this speed things up??
  const list: HTMLSpanElement[] = [];
  sanitizeHTML(
    lexdiv,
    markSearchMatches(
      G.LibSword.getSearchResults(
        dModule,
        0,
        C.UI.Search.maxLexiconSearchResults,
        true,
        null
      ),
      getSearchMatches(searchtext, searchtype)
    )
  );

  // If searching for a Strong's number, collect all its translations.
  if (strongs) {
    strongs.forEach((s) => {
      const c = `S_${s.replace(/lemma:\s*/, '')}`;
      const snlex: { text: string; count: number }[] = [];

      // Iterate through each and every element having this Strong's number
      Array.from(lexdiv.getElementsByClassName(c)).forEach((el) => {
        let j;
        for (j = 0; j < snlex.length; j += 1) {
          if (el.innerHTML === snlex[j].text) {
            snlex[j].count += 1;
            break;
          }
        }
        if (j === snlex.length) snlex.push({ text: el.innerHTML, count: 1 });
      });

      // sort the results
      snlex.sort((a, b) => {
        return b.count - a.count;
      });

      // format and save the results
      const dictinfo = getStrongsModAndKey(c);
      const slist = document.createElement('span');
      list.push(slist);
      slist.className = 'slist';
      if (dictinfo.key) {
        slist.dataset.title = `${encodeURIComponent(dictinfo.key)}.${
          dictinfo.mod
        }`;
      }
      const strongNum = c.replace('S_', '');

      const a = slist.appendChild(document.createElement('a'));
      if (dictinfo.mod && dictinfo.key) a.className = `sn ${c}`;
      a.textContent = strongNum;
      a.id = `strongslink.${dModule}.lemma:${strongNum}`;

      const span1 = slist.appendChild(document.createElement('span'));
      span1.className = 'lex-total';
      span1.textContent = `${dString(1)}-${dString(
        count > C.UI.Search.maxLexiconSearchResults
          ? C.UI.Search.maxLexiconSearchResults
          : count
      )}`;

      const span2 = slist.appendChild(document.createElement('span'));
      span2.className = `cs-${dModule}`;
      snlex.forEach((snl) => {
        const child1 = span2.appendChild(document.createElement('span'));
        child1.className = 'lex-text';
        child1.textContent = snl.text;

        const child2 = span2.appendChild(document.createElement('span'));
        child2.className = 'lex-count';
        child2.textContent = snl.count.toString();
      });
    });
  } else {
    // Otherwise searching for strings. Find all corresponding Strong's numbers.
    type Sts = { strongs: string; count: number };
    const strongsLists = { H: [] as Sts[], G: [] as Sts[] };
    Array.from(lexdiv.getElementsByClassName('searchterm')).forEach((term) => {
      const p = term.parentNode as HTMLElement;
      if (p) {
        const sclass = p.className.match(/(^|\s)S_(G|H)(\d+)(\s|$)/g);
        if (sclass && sclass.length) {
          sclass.forEach((sc) => {
            const [, mclass, mtypex] = Array.from(
              sc.match(/(?:^|\s)(S_(G|H)\d+)(?:\s|$)/) || []
            );
            const mtype = mtypex as keyof typeof strongsLists;
            let j;
            for (j = 0; j < strongsLists[mtype].length; j += 1) {
              if (mclass === strongsLists[mtype][j].strongs) {
                strongsLists[mtype][j].count += 1;
                break;
              }
            }
            if (j === strongsLists[mtype].length)
              strongsLists[mtype].push({ strongs: mclass, count: 1 });
          });
        }
      }
    });

    // format and write the results in the Lexicon section
    Object.entries(strongsLists).forEach((entry) => {
      const [hgx, stsa] = entry;
      const hg = hgx as 'H' | 'G';
      // sort the results
      stsa.sort((a, b) => {
        return b.count - a.count;
      });

      if (stsa.length) {
        const snlist = document.createElement('span');
        list.push(snlist);
        snlist.className = 'snlist';
        snlist.dataset.conmod = dModule;

        let mtype = '';
        if (hg === 'H') mtype = i18n.t('ORIGLabelOT');
        if (hg === 'G') mtype = i18n.t('ORIGLabelNT');

        const span3 = snlist.appendChild(document.createElement('span'));
        span3.className = 'strongs-type';
        span3.textContent = mtype;

        const span4 = snlist.appendChild(document.createElement('span'));
        span4.className = 'lex-total';
        const c =
          count > C.UI.Search.maxLexiconSearchResults
            ? C.UI.Search.maxLexiconSearchResults
            : count;
        span4.textContent = `${dString(1)}-${dString(c)}`;

        const span5 = snlist.appendChild(document.createElement('span'));
        span5.className = 'cs-locale';

        stsa.forEach((sts: Sts) => {
          const strongNum = sts.strongs.replace('S_', '');
          const sti = getStrongsModAndKey(sts.strongs);

          const a = span5.appendChild(document.createElement('a'));
          if (sti.mod && sti.key) a.className = `sn ${sts.strongs}`;
          a.id = ['strongslink', dModule, `lemma:${strongNum}`].join('.');
          const span6 = a.appendChild(document.createElement('span'));
          span6.className = 'lex-text';
          span6.textContent = strongNum;

          const span7 = span5.appendChild(document.createElement('span'));
          span7.className = 'lex-count';
          span7.textContent = sts.count.toString();
        });
      }
    });
  }

  // now display the list
  while (lexdiv.firstChild) {
    lexdiv.removeChild(lexdiv.firstChild);
  }
  if (!list.length) {
    sanitizeHTML(lexdiv, '');
  } else {
    list.forEach((ns) => {
      lexdiv.appendChild(ns);
    });
  }
  lexdiv.style.display = ''; // was set to 'none' earlier
}

export default function handler(this: SearchWin, e: React.SyntheticEvent) {
  const state = this.state as SearchWinState;
  const target = e.target as HTMLElement;
  const currentTarget = e.currentTarget as HTMLElement;
  switch (e.type) {
    case 'click': {
      switch (currentTarget.id) {
        case 'moreLess': {
          this.setState((prevState: SearchWinState) => {
            const s: Partial<SearchWinState> = {
              moreLess: !prevState.moreLess,
            };
            return s;
          });
          break;
        }
        case 'searchButton': {
          search(this);
          break;
        }
        case 'helpButton': {
          break;
        }
        case 'createIndexButton': {
          const { module } = state;
          if (module && G.Tab[module]) {
            createSearchIndex(this, module);
          }
          break;
        }
        case 'pagefirst': {
          this.setState({ pageindex: 0 });
          break;
        }
        case 'pagelast': {
          let pageindex = state.count - C.UI.Search.resultsPerPage;
          if (pageindex < 0) pageindex = 0;
          this.setState({ pageindex });
          break;
        }
        case 'pageprev': {
          let pageindex = state.pageindex - C.UI.Search.resultsPerPage;
          if (pageindex < 0) pageindex = 0;
          this.setState({ pageindex });
          break;
        }
        case 'pagenext': {
          let pageindex = state.pageindex + C.UI.Search.resultsPerPage;
          if (pageindex >= state.count)
            pageindex = state.count - C.UI.Search.resultsPerPage;
          if (pageindex < 0) pageindex = 0;
          this.setState({ pageindex });
          break;
        }
        case 'searchResults':
        case 'lexiconResults': {
          const p = target.id.split('.');
          const link = p.shift();
          switch (link) {
            case 'verselink': {
              const l: LocationVKType = {
                v11n: p.shift() as V11nType,
                book: p.shift() as string,
                chapter: Number(p.shift()),
                verse: Number(p.shift()),
              };
              G.Commands.goToLocationVK(l, l);
              break;
            }
            case 'keylink': {
              const module = p.shift();
              if (module && module in G.Tab) {
                G.Commands.goToLocationSK({ module, key: p.join('.') });
              }
              break;
            }
            case 'strongslink': {
              G.Commands.search({
                module: p.shift() as string,
                searchtext: p.join('.'),
                type: 'SearchAdvanced',
              });
              break;
            }
            default:
          }
          break;
        }

        default:
          throw Error(`Unhandled searchH click on id '${target.id}'`);
      }
      break;
    }
    case 'change': {
      const targid = currentTarget.id as keyof SearchWinState;
      switch (targid) {
        case 'searchtext':
        case 'module':
        case 'displayBible':
        case 'searchtype':
        case 'scoperadio':
        case 'scopeselect': {
          const se = target as any;
          this.setState({ [targid]: se.value });
          e.stopPropagation();
          break;
        }

        default:
          throw Error(`Unhandled searchH change on id '${target.id}'`);
      }
      break;
    }
    default:
      throw Error(`Unhandled searchH event type ${e.type}`);
  }
}

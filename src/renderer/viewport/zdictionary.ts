/* eslint-disable no-continue */
import Cache from '../../cache';
import { JSON_attrib_stringify } from '../../common';
import C from '../../constant';
import G from '../rg';
import log from '../log';

import type { SwordFilterType, SwordFilterValueType } from '../../type';
import type { HTMLData } from '../htmlData';

const DictKeyTransform: { [i: string]: (key: string) => string } = {
  StrongsHebrew: (key) => {
    const t = '00000';
    return t.substring(0, t.length - key.length) + key;
  },
  StrongsGreek: (key) => {
    const t = '00000';
    return t.substring(0, t.length - key.length) + key;
  },
};

// class must be a string or a regular-expression to match a string
function replaceTags(entry: string, tag: string, subclass?: string | RegExp) {
  const eTag = new RegExp(`<\\/${tag}[^>]*>`, 'g');
  let html = entry.replace(eTag, '</span>');

  const sTag = new RegExp(`<${tag}([^>]*)>`);
  let html2;
  do {
    html2 = html;
    const p = html.match(sTag);
    if (p) {
      let mclass;
      if (subclass && typeof subclass !== 'string') {
        const match = p[1].match(subclass);
        if (match) [, mclass] = match;
      } else mclass = subclass;

      const rend = p[1].match(/rend="(.*?)"/);

      html = html.replace(
        p[0],
        `<span class="markup-${tag}${mclass ? `-${mclass}` : ''}${
          rend ? ` markup_${rend[1]}` : ''
        }">`
      );
    }
  } while (html2 !== html);

  return html;
}

function markup2html(entry: string, mod: string) {
  // sense
  let html = entry.replace(/<\/sense[^>]*>/g, '</span>');
  let html2;
  do {
    html2 = html;
    const p = html.match(/<sense([^>]*)>(.*?<)/);
    if (p) {
      const match = p[1].match(/n="(.*?)"/);
      const n = match && p[2].indexOf(match[1]) !== 0 ? match[1] : '';
      html = html.replace(
        p[0],
        `<span class="markup-sense">${n ? `<b>${n}</b>` : ''}${
          n && !/^[.]/.test(p[2]) ? '. ' : ''
        }${p[2]}`
      );
    }
  } while (html !== html2);

  // ref
  html = html.replace(/<\/ref[^>]*>/g, '</span>');
  do {
    html2 = html;
    const p = html.match(/<ref([^>]*)>/);
    if (p) {
      const osisID = p[1].match(/osisRef="(.*?)"/);
      const target = p[1].match(/target="(.*?)"/);
      let mclass = '';
      let mtitle = '';
      if (osisID) {
        mtitle = `${osisID[1]}.${mod}`;
        mclass = 'sr';
      } else if (target) {
        mtitle = target[1].replace('self:', `${mod}:`);
        mtitle = `${mtitle}.${mod}`;
        mclass = 'dtl';
      }
      html = html.replace(
        p[0],
        `<span class="${mclass}" data-title="${mtitle}">`
      );
    }
  } while (html !== html2);

  html = replaceTags(html, 'orth', /type="(.*?)/);
  html = replaceTags(html, 'hi');
  html = replaceTags(html, 'pron');
  html = replaceTags(html, 'def');
  html = replaceTags(html, 'entryFree');
  html = replaceTags(html, 'title');
  html = replaceTags(html, 'foreign');
  html = replaceTags(html, 'xr');
  html = replaceTags(html, 'entry');
  html = replaceTags(html, 'form');
  html = replaceTags(html, 'etym', /n="(.*?)"/);
  html = replaceTags(html, 'cit');
  html = replaceTags(html, 'usg');
  html = replaceTags(html, 'quote');
  html = replaceTags(html, 'note');
  html = replaceTags(html, 'emph');
  html = replaceTags(html, 'gramGrp');
  html = replaceTags(html, 'pos');

  return html;
}

// some TEI mods (like AbbottSmith, Strong) may use @LINK, so replace these here.
function replaceLinks(entry: string, mod: string) {
  let html = entry;
  const link = html.match(/(@LINK\s+[^\s<]+)/g);
  if (link) {
    for (let x = 0; x < link.length; x += 1) {
      const l = link[x].match(/@LINK\s+([^\s<]+)/);
      if (!l) continue;

      // fix problems related to AbbottSmith module...
      if (mod === 'AbbottSmith') {
        const hack = { ΐ: 'Ϊ́', ὐ: 'Υ̓' };
        Object.entries(hack).forEach((ane) => {
          const [f, t] = ane;
          l[1] = l[1].replace(new RegExp(f, 'g'), t);
        });
        if (l[1] === 'ἀγαλλίασις') l[1] = ' ἈΓΑΛΛΊΑΣΙΣ'; // key needs space before!
      }

      let r = G.LibSword.getDictionaryEntry(mod, l[1].toUpperCase());
      if (!r) r = G.LibSword.getDictionaryEntry(mod, l[1]);
      if (r) html = html.replace(l[0], r);
    }
  }

  return html;
}

export function getDictEntryHTML(
  key: string,
  modules: string,
  libswordFiltersReady = false
) {
  const mods = modules.split(';');

  if (!libswordFiltersReady) {
    const options = {} as { [key in SwordFilterType]: SwordFilterValueType };
    Object.entries(C.SwordFilters).forEach((entry) => {
      const sword = entry[0] as SwordFilterType;
      if (C.AlwaysOn[C.DICTIONARY].includes(sword)) {
        [, options[sword]] = C.SwordFilterValues;
      }
    });
    G.LibSword.setGlobalOptions(options);
  }

  let html = '';
  let sep = '';
  mods.forEach((mx) => {
    // Allow case differences in module code references.
    let m = mx;
    if (!(m in G.Tab)) {
      const mlc = m.toLowerCase();
      m = Object.keys(G.Tab).find((md) => md.toLowerCase() === mlc) || '';
    }
    if (m && m in G.Tab && G.Tab[m].type === C.DICTIONARY) {
      const k = DictKeyTransform[m] ? DictKeyTransform[m](key) : key;
      let h = '';
      try {
        h = G.LibSword.getDictionaryEntry(m, k);
      } catch (er) {
        h = '';
      }
      if (!h) {
        try {
          h = G.LibSword.getDictionaryEntry(m, k.toUpperCase());
        } catch (er) {
          h = '';
        }
      }
      if (h) h = markup2html(replaceLinks(h, m), m);
      if (mods.length === 1) {
        html += h;
      } else {
        html = html.replace(/^(<br>)+/, '');
        const dictTitle = G.LibSword.getModuleInformation(m, 'Description');
        html += `${sep}
        <div class="cs-${m}">${
          dictTitle === C.NOTFOUND
            ? ''
            : `<div class="dict-description">${dictTitle}</div>`
        }${h}
        </div>`;
        sep = `<div class="dict-sep"></div>`;
      }
    }
  });
  if (!html) return '';

  // Add a heading
  html = `
    <div>
      <div class="dict-entry-heading cs-${mods[0]}">${key}:</div>
      ${html}
    </div>`;

  return html;
}

export function getStrongsModAndKey(snclass: string): {
  mod: string | null;
  key: string | null;
} {
  let type = null;
  let key = null;
  let mod = null;
  const parts = snclass.split('_');
  if (!parts || !parts[1]) return { mod, key };

  [type, key] = parts;
  key = key.replace(/ /g, ''); // why?

  switch (type) {
    case 'S': {
      // Strongs Hebrew or Greek tags
      let feature = null;
      if (key.charAt(0) === 'H') {
        feature = 'hebrewDef';
      } else if (key.charAt(0) === 'G') {
        if (Number(key.substring(1)) >= 5627) return { mod, key }; // SWORD filters these out- not valid it says
        feature = 'greekDef';
      }
      if (feature) {
        mod = G.Prefs.getCharPref(`global.popup.selection.${feature}`) || null;
      }
      if (!mod) {
        key = null;
        return { mod, key };
      }

      const styp = feature === 'hebrewDef' ? 'H' : 'G';
      const snum = Number(key.substring(1));
      if (Number.isNaN(Number(snum))) {
        key = null;
        return { mod, key };
      }
      const pad4 =
        String('000').substring(0, 3 - (String(snum).length - 1)) +
        String(snum);

      // possible keys in order of likelyhood
      const keys = [
        `0${pad4}`,
        `${styp}${pad4}`,
        `${pad4}`,
        `${styp}${snum}`,
        `${snum}`,
        `${styp}0${pad4}`,
      ];

      // try out key possibilities until we find a correct key for this mod
      if (mod) {
        let k;
        for (k = 0; k < keys.length; k += 1) {
          try {
            if (G.LibSword.getDictionaryEntry(mod, keys[k])) break;
          } catch (er) {
            mod = null;
            break;
          }
        }
        if (mod && k < keys.length) key = keys[k];
      }
      break;
    }

    case 'RM': {
      // Robinson's Greek parts of speech tags (used by KJV)
      if (G.FeatureModules.greekParse.includes('Robinson')) mod = 'Robinson';
      break;
    }

    case 'SM': {
      // no lookup module available for these yet...
      mod =
        G.Prefs.getCharPref('global.popup.selection.greekParse') ||
        G.FeatureModules.greekParse[0] ||
        null;
      break;
    }

    default: {
      // meaning of tag is unknown
      log.warn(`Unknown Strongs type: '${type}'`);
      key = null;
    }
  }

  return { mod, key };
}

// Builds HTML text which displays lemma information from numberList.
// numberList form: (S|WT|SM|RM)_(G|H)#
export function getLemmaHTML(
  strongsClassArray: string[],
  matchingPhrase: string,
  sourcemod: string
) {
  // Start building html
  let html = '';
  let sep = '';
  let info;
  for (let i = 0; i < strongsClassArray.length; i += 1) {
    info = getStrongsModAndKey(strongsClassArray[i]);

    // add a button to search for this Strong's number
    let buttonHTML = '';
    if (
      /^S_/.test(strongsClassArray[i]) &&
      !/^S_(DSS|MT)/.test(strongsClassArray[i])
    ) {
      // DSS|MT for SPVar module
      const code = strongsClassArray[i].replace(/^[^_]+_/, '');
      const data: HTMLData = {
        type: 'snbut',
        reflist: [code],
        context: sourcemod,
      };
      const d = JSON_attrib_stringify(data);
      buttonHTML += `<button type="button" class="snbut" data-data="${d}">${code}</button>`;
    }

    if (info.key && info.mod) {
      if (Number(info.key) === 0) continue; // skip G tags with no number
      const entry = G.LibSword.getDictionaryEntry(info.mod, info.key);
      if (entry) {
        html +=
          sep +
          buttonHTML +
          markup2html(replaceLinks(entry, info.mod), info.mod);
      } else html += sep + buttonHTML + info.key;
    } else
      html +=
        sep + buttonHTML + strongsClassArray[i].replace(/S_(DSS|MT)_/g, '$1: '); // DSS|MT for SPVar module

    sep = '<div class="lemma-sep"></div>';
  }

  // Add heading now that we know module styling
  html = `<div class="lemma-html cs-${
    info && info.mod ? info.mod : 'Program'
  }"><div class="lemma-header">${matchingPhrase}</div>${html}<div>`;

  return html;
}

export function getAllDictionaryKeys(module: string): string[] {
  if (!Cache.has('keylist', module)) {
    let list: string[] = G.LibSword.getAllDictionaryKeys(module).split('<nx>');
    list.pop();
    // KeySort entry enables localized list sorting by character collation.
    // Square brackets are used to separate any arbitrary JDK 1.4 case
    // sensitive regular expressions which are to be treated as single
    // characters during the sort comparison. Also, a single set of curly
    // brackets can be used around a regular expression which matches any
    // characters/patterns that need to be ignored during the sort comparison.
    // IMPORTANT: Any square or curly bracket within regular expressions must
    // have had an additional backslash added before it.
    const sort0 = G.LibSword.getModuleInformation(module, 'KeySort');
    if (sort0 !== C.NOTFOUND) {
      const sort = `-${sort0}0123456789`;
      const getignRE = /(?<!\\)\{(.*?)(?<!\\)\}/; // captures the ignore regex
      const getsrtRE = /^\[(.*?)(?<!\\)\]/; // captures sorting regexes
      const getescRE = /\\(?=[{}[\]])/g; // matches the KeySort escapes
      const ignoreREs: RegExp[] = [/\s/];
      const ignREm = sort.match(getignRE);
      if (ignREm) ignoreREs.push(new RegExp(ignREm[1].replace(getescRE, '')));
      let sort2 = sort.replace(getignRE, '');
      let sortREs: [number, number, RegExp][] = [];
      for (let i = 0; sort2.length; i += 1) {
        let re = sort2.substring(0, 1);
        let rlen = 1;
        const mt = sort2.match(getsrtRE);
        if (mt) {
          [, re] = mt;
          rlen = re.length + 2;
        }
        sortREs.push([i, re.length, new RegExp(`^(${re})`)]);
        sort2 = sort2.substring(rlen);
      }
      sortREs = sortREs.sort((a, b) => {
        const [, alen] = a;
        const [, blen] = b;
        if (alen > blen) return -1;
        if (alen < blen) return 1;
        return 0;
      });
      list = list.sort((aa, bb) => {
        let a = aa;
        let b = bb;
        ignoreREs.forEach((re) => {
          a = aa.replace(re, '');
          b = bb.replace(re, '');
        });
        for (; a.length && b.length; ) {
          let x;
          let am;
          let bm;
          for (x = 0; x < sortREs.length; x += 1) {
            const [, , re] = sortREs[x];
            if (am === undefined && re.test(a)) am = sortREs[x];
            if (bm === undefined && re.test(b)) bm = sortREs[x];
          }
          if (am !== undefined && bm !== undefined) {
            const [ia, , rea] = am;
            const [ib, , reb] = bm;
            if (ia < ib) return -1;
            if (ia > ib) return 1;
            a = a.replace(rea, '');
            b = b.replace(reb, '');
          } else if (am !== undefined && bm === undefined) {
            return -1;
          } else if (am === undefined && bm !== undefined) {
            return 1;
          }
          const ax = a.charCodeAt(0);
          const bx = b.charCodeAt(0);
          if (ax < bx) return -1;
          if (ax > bx) return 1;
          a = a.substring(1);
          b = b.substring(1);
        }
        if (a.length && !b.length) return -1;
        if (!a.length && b.length) return 1;
        return 0;
      });
    }
    Cache.write(list, 'keylist', module);
  }
  return Cache.read('keylist', module);
}

/* eslint-disable no-continue */
import C from '../../constant';
import G from '../rg';
import log from '../log';

import type { SwordFilterType, SwordFilterValueType } from '../../type';

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
      buttonHTML += '<button type="button" class="snbut" ';
      buttonHTML += `data-title="${
        info.mod ? info.mod : 'Program'
      }:${strongsClassArray[i].replace(/^[^_]+_/, '')}.${sourcemod}">`;
      buttonHTML += strongsClassArray[i].replace(/^[^_]+_/, '');
      buttonHTML += '</button>';
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

import { JSON_attrib_stringify, getSwordOptions } from '../../../common.ts';
import Cache from '../../../cache.ts';
import type S from '../../../defaultPrefs.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import log from '../../log.ts';
import type RenderPromise from '../../renderPromise.ts';

import type { HTMLData } from '../../htmlData.ts';
import type { FailReason } from '../popup/popupH.ts';

const DictKeyTransform: Record<string, (key: string) => string> = {
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
        }">`,
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
        }${p[2]}`,
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
        `<span class="${mclass}" data-title="${mtitle}">`,
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
function replaceLinks(
  entry: string,
  mod: string,
  renderPromise?: RenderPromise,
) {
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

      const options = getSwordOptions(G, C.DICTIONARY);
      if (mod && mod in G.Tab) {
        let { text } = GI.LibSword.getDictionaryEntry(
          { text: C.NOTFOUND, notes: '' },
          renderPromise,
          mod,
          l[1].toUpperCase(),
          options,
        );
        if (text === C.NOTFOUND)
          ({ text } = GI.LibSword.getDictionaryEntry(
            { text: C.NOTFOUND, notes: '' },
            renderPromise,
            mod,
            l[1],
            options,
          ));
        if (text) html = html.replace(l[0], text);
      }
    }
  }

  return html;
}

export function dictKeyToday(modkey: string, module: string): string {
  let key = modkey;
  if (
    G.FeatureModules.DailyDevotion.includes(module) &&
    !Cache.has('DailyDevotion', module)
  ) {
    const today = new Date();
    const mo = today.getMonth() + 1;
    const dy = today.getDate();
    key = `${mo < 10 ? '0' : ''}${String(mo)}.${dy < 10 ? '0' : ''}${dy}`;
    Cache.write(true, 'DailyDevotion', module);
  }
  return key;
}

export function getDictEntryHTML(
  key: string,
  modules: string,
  reason?: FailReason,
  renderPromise?: RenderPromise,
): string {
  const mods = modules.split(';');

  const options = getSwordOptions(G, C.DICTIONARY);

  let html = '';
  let sep = '';
  mods.forEach((mx) => {
    // Allow case differences in module code references.
    const mlc = mx.toLowerCase();
    const m =
      mx in G.Tab
        ? mx
        : Object.keys(G.Tab).find((md) => md.toLowerCase() === mlc) || '';
    if (m && m in G.Tab && G.Tab[m].type === C.DICTIONARY) {
      const k = DictKeyTransform[m] ? DictKeyTransform[m](key) : key;
      const { text: h1 } = GI.LibSword.getDictionaryEntry(
        { text: C.NOTFOUND, notes: '' },
        renderPromise,
        m,
        k,
        options,
      );
      const { text: h2 } = GI.LibSword.getDictionaryEntry(
        { text: C.NOTFOUND, notes: '' },
        renderPromise,
        m,
        k.toUpperCase(),
        options,
      );
      const dictTitle = GI.LibSword.getModuleInformation(
        '',
        renderPromise,
        m,
        'Description',
      );
      let h = h1;
      if (h === C.NOTFOUND) h = h2;
      if (h) h = markup2html(replaceLinks(h, m, renderPromise), m);
      if (mods.length === 1) {
        html += h;
      } else {
        html = html.replace(/^(<br>)+/, '');
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
    if (!m && reason) reason.requires.push(mx);
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

export function getStrongsModAndKey(
  snclass: string,
  renderPromise?: RenderPromise,
  reason?: FailReason,
): {
  mod: string | null;
  key: string | null;
} {
  let type = null;
  let key = null;
  let mod = null;
  const parts = snclass.split('_');
  if (!parts?.[1]) {
    if (reason) reason.reason = `${snclass}?`;
    return { mod: null, key: null };
  }

  [type, key] = parts;
  key = key.replace(/ /g, ''); // why?

  switch (type) {
    case 'S': {
      // Strongs Hebrew or Greek tags
      let feature: 'HebrewDef' | 'GreekDef' | null = null;
      if (key.charAt(0) === 'H') {
        feature = 'HebrewDef';
      } else if (key.charAt(0) === 'G') {
        if (Number(key.substring(1)) >= 5627) {
          if (reason) reason.reason = `${key.substring(1)} >= 5627?`;
          return { mod, key }; // SWORD filters these out- not valid it says
        }
        feature = 'GreekDef';
      }
      if (feature) {
        const f = G.Prefs.getComplexValue(
          'global.popup.feature',
        ) as typeof S.prefs.global.popup.feature;
        mod = (feature in f && f[feature]) || null;
      }
      if (!mod) {
        if (reason) {
          if (feature) {
            const requires =
              C.LocalePreferredFeature[G.i18n.language === 'en' ? 'en' : 'ru'][
                feature
              ];
            if (requires?.length) reason.requires.push(...requires);
          } else reason.reason = `${snclass}?`;
        }
        return { mod, key };
      }

      const styp = feature === 'HebrewDef' ? 'H' : 'G';
      const snum = Number(key.substring(1));
      if (!snum || Number.isNaN(Number(snum))) {
        if (reason) reason.reason = `${snclass}? (${snum} isNaN)`;
        key = null;
        mod = null;
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
      const options = getSwordOptions(G, C.DICTIONARY);
      if (mod && mod in G.Tab) {
        let k;
        let text;
        for (k = 0; k < keys.length; k += 1) {
          ({ text } = GI.LibSword.getDictionaryEntry(
            { text: C.NOTFOUND, notes: '' },
            renderPromise,
            mod,
            keys[k],
            options,
          ));
          if (text !== C.NOTFOUND) break;
        }
        if (text === C.NOTFOUND) mod = null;
        if (mod && k < keys.length) key = keys[k];
        if ((!mod || !key) && reason) {
          reason.reason = `${snclass}? (${snum})`;
        }
      }
      break;
    }

    case 'RM': {
      // Robinson's Greek parts of speech tags (used by KJV)
      if (G.FeatureModules.GreekParse.includes('Robinson')) mod = 'Robinson';
      break;
    }

    case 'SM': {
      // no lookup module available for these yet...
      const f = G.Prefs.getComplexValue(
        'global.popup.feature',
      ) as typeof S.prefs.global.popup.feature;
      mod = f.GreekParse || G.FeatureModules.GreekParse[0] || null;
      if (!mod && reason) {
        reason.reason = `${snclass} (SM?)`;
      }
      break;
    }

    default: {
      // meaning of tag is unknown
      if (reason) reason.reason = `${snclass}? (${type})`;
      log.warn(`Unknown Strongs type: '${type}'`);
      key = null;
    }
  }

  if (mod && !(mod in G.Tab)) {
    if (reason) reason.requires.push(mod);
    mod = null;
    return { mod, key };
  }
  return { mod, key };
}

// Builds HTML text which displays lemma information from numberList.
// numberList form: (S|WT|SM|RM)_(G|H)#. If information cannot be
// found, a preferred required module will be returned as the reason.
export function getLemmaHTML(
  strongsClassArray: string[],
  matchingPhrase: string,
  sourcemod: string,
  renderPromise?: RenderPromise,
  reason?: FailReason,
) {
  // Start building html
  let html = '';
  let sep = '';
  let info;
  for (let i = 0; i < strongsClassArray.length; i += 1) {
    info = getStrongsModAndKey(strongsClassArray[i], renderPromise, reason);
    if (!info.mod) continue;

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

    const options = getSwordOptions(G, C.DICTIONARY);
    if (info.key && info.mod && info.mod in G.Tab) {
      if (Number(info.key) === 0) continue; // skip G tags with no number
      const { text } = GI.LibSword.getDictionaryEntry(
        { text: '', notes: '' },
        renderPromise,
        info.mod,
        info.key,
        options,
      );
      if (text) {
        html +=
          sep +
          buttonHTML +
          markup2html(replaceLinks(text, info.mod, renderPromise), info.mod);
      } else if (reason) {
        reason.reason = `${info.mod}:${info.key}?`;
      }
    } else
      html +=
        sep + buttonHTML + strongsClassArray[i].replace(/S_(DSS|MT)_/g, '$1: '); // DSS|MT for SPVar module

    sep = '<div class="lemma-sep"></div>';
  }
  if (!html) return html;

  // Add heading now that we know module styling
  return `
    <div class="lemma-html cs-${info?.mod ? info.mod : 'Program'}">
      <div class="lemma-header">${matchingPhrase}</div>
      ${html}
    <div>`;
}

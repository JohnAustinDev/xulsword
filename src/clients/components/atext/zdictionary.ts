import { JSON_attrib_stringify, getSwordOptions } from '../../../common.ts';
import Cache from '../../../cache.ts';
import type S from '../../../defaultPrefs.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import log from '../../log.ts';
import analytics from '../../analytics.ts';
import hebrewTVM from './hebrewTVM.ts';

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
  renderPromise: RenderPromise,
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

export function dictKeyToday(module: string): string {
  if (
    G.FeatureModules.DailyDevotion.includes(module) &&
    !Cache.has('DailyDevotion', module)
  ) {
    const today = new Date();
    const mo = today.getMonth() + 1;
    const dy = today.getDate();
    Cache.write(true, 'DailyDevotion', module);
    return `${mo < 10 ? '0' : ''}${String(mo)}.${dy < 10 ? '0' : ''}${dy}`;
  }
  return '';
}

export function getDictEntryHTML(
  key: string,
  modules: string,
  renderPromise: RenderPromise,
  reason?: FailReason,
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

type StrongsInfo = {
  mod: string | null;
  key: string | null;
  text?: string; // an entry that does not come from a module
};

// Look up a morphology (parse) code. Only Robinson links keep their scheme
// (as RM_): packard, oshm, strongMorph and others all become SM_, and some
// texts put parse codes in lemma attributes. So try every parse module,
// starting with those in first, until one has the key. The modules' keys
// don't clash (shared Robinson and Packard codes mean the same thing), so no
// user preference is involved.
function lookupParseCode(
  code: string,
  first: string[],
  features: Array<'GreekParse' | 'HebrewParse'>,
  renderPromise: RenderPromise,
  reason?: FailReason,
): StrongsInfo {
  const mods = [
    ...first,
    ...features.flatMap((f) => G.FeatureModules[f]),
  ].filter((m, i, a) => m in G.Tab && a.indexOf(m) === i);
  const options = getSwordOptions(G, C.DICTIONARY);
  const findKey = (ms: string[], key: string) =>
    GI.LibSword.getFirstDictionaryEntry(
      { mod: '', key: '', text: C.NOTFOUND, notes: '' },
      renderPromise,
      ms,
      // SWORD upper-cases the keys of most dictionaries (OSHM: HVqp3ms).
      [key, key.toUpperCase()].filter((k, i, a) => a.indexOf(k) === i),
      options,
    );

  const r = mods.length ? findKey(mods, code) : null;
  if (!r?.mod || !r.text || r.text === C.NOTFOUND) {
    // Suggest the module of the code's scheme, if it isn't installed.
    if (reason && first[0] && !(first[0] in G.Tab)) {
      reason.requires.push(first[0]);
    } else if (Build.isDevelopment) {
      log.debug(`Parse code '${code}' was not found in: ${mods.join(', ')}`);
    }
    return { mod: null, key: null };
  }

  // Some entries only point to another entry: Robinson's G5656 entry is a
  // link to V-AAI. Show the target entry instead.
  const { mod } = r;
  let { key } = r;
  const target = r.text
    .replace(/<[^>]*>/g, ' ')
    .replace(key, '')
    .trim();
  if (target && target !== key && /^\S+$/.test(target)) {
    const t = findKey([mod], target);
    if (t.mod && t.text && t.text !== C.NOTFOUND) ({ key } = t);
  }
  return { mod, key };
}

// Strong's Hebrew TVM codes are not in any module.
function hebrewTVMInfo(code: string): StrongsInfo {
  const text = hebrewTVM(code);
  return text ? { mod: null, key: code, text } : { mod: null, key: null };
}

// Strong's Greek tense codes (G5656) are keys of the Robinson module.
function greekTVMInfo(
  num: number,
  renderPromise: RenderPromise,
  reason?: FailReason,
): StrongsInfo {
  return lookupParseCode(
    `G${num}`,
    ['Robinson'],
    ['GreekParse'],
    renderPromise,
    reason,
  );
}

function lookupStrongsNumber(
  styp: 'G' | 'H',
  snum: number,
  snclass: string,
  renderPromise: RenderPromise,
  reason?: FailReason,
  noAnalytics = false,
): StrongsInfo {
  // Strong's numbers stop at H8674 and G5624. Higher numbers are tense codes.
  if (styp === 'H' && snum > 8674) return hebrewTVMInfo(`TH${snum}`);
  if (styp === 'G' && snum > 5624) {
    return greekTVMInfo(snum, renderPromise, reason);
  }

  const feature = styp === 'H' ? 'HebrewDef' : 'GreekDef';
  const f = G.Prefs.getComplexValue(
    'global.popup.feature',
  ) as typeof S.prefs.global.popup.feature;
  const mod = (feature in f && f[feature]) || null;
  if (!mod) {
    if (reason) {
      const requires =
        C.LocalePreferredFeature[G.i18n.language === 'en' ? 'en' : 'ru'][
          feature
        ];
      if (requires?.length) reason.requires.push(...requires);
    }
    return { mod: null, key: null };
  }
  if (!(mod in G.Tab)) {
    if (reason) reason.requires.push(mod);
    return { mod: null, key: null };
  }

  const pad4 =
    String('000').substring(0, 3 - (String(snum).length - 1)) + String(snum);

  // possible keys in order of likelyhood
  const keys = [
    `0${pad4}`,
    `${styp}${pad4}`,
    `${pad4}`,
    `${styp}${snum}`,
    `${snum}`,
    `${styp}0${pad4}`,
  ];

  // Try out key possibilities until we find a correct key. Some modules lack
  // some numbers (StrongsGreek has no 3778) so then try the feature's other
  // modules, preferring those of the locale.
  const locale = G.i18n.language === 'en' ? 'en' : 'ru';
  const mods = [
    mod,
    ...(C.LocalePreferredFeature[locale][feature] ?? []),
    ...G.FeatureModules[feature],
  ].filter((m, i, a) => m in G.Tab && a.indexOf(m) === i);
  const r = GI.LibSword.getFirstDictionaryEntry(
    { mod: '', key: '', text: C.NOTFOUND, notes: '' },
    renderPromise,
    mods,
    keys,
    getSwordOptions(G, C.DICTIONARY),
  );
  if (!r.mod || !r.key || !r.text || r.text === C.NOTFOUND) {
    if (reason) reason.reason = `${snclass}? (${snum})`;
    return { mod: null, key: null };
  }
  if (!noAnalytics) {
    analytics.record({
      event: 'glossary',
      module: r.mod,
      locationky: r.key,
    });
  }
  return { mod: r.mod, key: r.key };
}

// Return the module and key for one class of a Strong's span (or a ready
// entry when no module defines the code). The classes are written by the Cpp
// xhtml filters from the lemma and morph attributes of OSIS <w> elements:
// lemma values become S_, robinson: morph values RM_ and other morph values
// SM_. Texts use these attributes in many ways. For example:
// S_H07225 S_G976 (KJVA)            Strong's numbers
// S_H1254a (NASB)                   Strong's number; the letter marks a sense
// S_TH8804 S_SMTG5656 (RSP)         Strong's Hebrew and Greek tense codes
// S_H S_G (RSP, TR)                 empty Strong's numbers
// S_GN-ASF (LXX)                    a Packard parse code
// S_βιβλος (KJVA lemma.TR)          a Greek word, no module defines these
// S_b S_c/l (OSHB)                  prefixes, no module defines these
// RM_V-AAI-3S (KJVA, TR, WHNU)      a Robinson parse code
// SM_N-DSF (LXX)                    a Packard parse code
// SM_V-2ADP-GSF (KJVA)              a Robinson parse code without its scheme
// SM_TH8804 (KJVA strongMorph)      a Strong's Hebrew tense code
// SM_G5656 (WHNU strongsMorph)      a Strong's Greek tense code
// SM_HR/Ncfsa (OSHB oshm)           an OSHM Hebrew parse code
export function getStrongsModAndKey(
  snclass: string,
  renderPromise: RenderPromise,
  reason?: FailReason,
  noAnalytics = false, // true when only testing whether a popup would render
): StrongsInfo {
  const none = { mod: null, key: null };
  const i = snclass.indexOf('_');
  if (i === -1) {
    if (reason) reason.reason = `${snclass}?`;
    return none;
  }
  const type = snclass.substring(0, i);
  const key = snclass.substring(i + 1).replace(/ /g, '');
  if (!key) return none;

  switch (type) {
    case 'S': {
      if (/^TH\d+$/.test(key)) return hebrewTVMInfo(key);
      const tg = key.match(/^(?:SMT|T)G(\d+)$/);
      if (tg) return greekTVMInfo(Number(tg[1]), renderPromise, reason);
      const sn = key.match(/^([GH])(\d+)[a-z]*$/);
      if (sn) {
        const snum = Number(sn[2]);
        if (!snum) return none;
        return lookupStrongsNumber(
          sn[1] as 'G' | 'H',
          snum,
          snclass,
          renderPromise,
          reason,
          noAnalytics,
        );
      }
      const pc = key.match(/^G([A-Z].*)$/);
      if (pc) {
        return lookupParseCode(
          pc[1],
          ['Packard', 'Robinson'],
          ['GreekParse'],
          renderPromise,
          reason,
        );
      }
      // Empty numbers, words and prefixes: no module defines these.
      return none;
    }

    case 'RM': {
      return lookupParseCode(
        key,
        ['Robinson', 'Packard'],
        ['GreekParse', 'HebrewParse'],
        renderPromise,
        reason,
      );
    }

    case 'SM': {
      if (/^TH\d+$/.test(key)) return hebrewTVMInfo(key);
      const tg = key.match(/^T?G(\d+)$/);
      if (tg) return greekTVMInfo(Number(tg[1]), renderPromise, reason);
      // OSHM codes: language (H or A), then part of speech and its lower-case
      // details, for each '/' separated part. Greek codes are upper-case.
      if (/^[HA][A-Z][a-z0-9]*(\/[A-Z][a-z0-9]*)*$/.test(key)) {
        return lookupParseCode(
          key,
          ['OSHM'],
          ['HebrewParse', 'GreekParse'],
          renderPromise,
          reason,
        );
      }
      return lookupParseCode(
        key,
        ['Packard', 'Robinson'],
        ['GreekParse', 'HebrewParse'],
        renderPromise,
        reason,
      );
    }

    default: {
      // meaning of tag is unknown
      if (reason) reason.reason = `${snclass}? (${type})`;
      if (Build.isDevelopment) log.warn(`Unknown Strongs type: '${type}'`);
    }
  }
  return none;
}

// Builds HTML text which displays lemma information from a Strong's span's
// classes (see getStrongsModAndKey). If information cannot be found, a
// preferred required module may be returned as the reason.
export function getLemmaHTML(
  strongsClassArray: string[],
  matchingPhrase: string,
  sourcemod: string,
  renderPromise: RenderPromise,
  reason?: FailReason,
  noAnalytics = false,
) {
  // Start building html
  let html = '';
  let sep = '';
  let csmod = '';
  const shown: string[] = [];
  const options = getSwordOptions(G, C.DICTIONARY);
  strongsClassArray.forEach((sclass) => {
    const info = getStrongsModAndKey(
      sclass,
      renderPromise,
      reason,
      noAnalytics,
    );
    if (!info.key || (!info.mod && !info.text)) return;

    // Texts may give the same code twice (LXX has strong:GN-ASF and
    // packard:N-ASF on one word), so show each entry only once.
    const id = `${info.mod ?? ''}:${info.key}`;
    if (shown.includes(id)) return;
    shown.push(id);

    let { text } = info;
    if (info.mod) {
      ({ text } = GI.LibSword.getDictionaryEntry(
        { text: '', notes: '' },
        renderPromise,
        info.mod,
        info.key,
        options,
      ));
      if (!text) {
        if (reason) reason.reason = `${info.mod}:${info.key}?`;
        return;
      }
      text = markup2html(replaceLinks(text, info.mod, renderPromise), info.mod);
      csmod = info.mod;
    }

    // add a button to search for this Strong's number
    let buttonHTML = '';
    const sn = sclass.match(/^S_([GH]\d+[a-z]*)$/);
    const { GreekDef, HebrewDef } = G.FeatureModules;
    if (sn && info.mod && [...GreekDef, ...HebrewDef].includes(info.mod)) {
      const data: HTMLData = {
        type: 'snbut',
        reflist: [sn[1]],
        context: sourcemod,
      };
      const d = JSON_attrib_stringify(data);
      // A BluePrint button with the search icon (see .snbut in popup.css).
      buttonHTML += `<button type="button" class="bp6-button snbut" data-data="${d}"><span class="bp6-icon snbut-icon" aria-hidden="true"></span><span class="bp6-button-text">${sn[1]}</span></button>`;
    }

    html += sep + buttonHTML + text;
    sep = '<div class="lemma-sep"></div>';
  });
  if (!html) return html;

  // Add heading now that we know module styling
  return `
    <div class="lemma-html cs-${csmod || 'Program'}">
      <div class="lemma-header">${matchingPhrase}</div>
      ${html}
    <div>`;
}

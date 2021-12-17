/* eslint-disable no-continue */
import { SwordFilterType, SwordFilterValueType } from '../../type';
import C from '../../constant';
import G from '../rg';

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
      html = html.replace(p[0], `<span class="${mclass}" title="${mtitle}">`);
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

export function getDictSortedKeyList(list: string[], keysort: string) {
  return list;
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
        const on = C.SwordFilterValues[1];
        options[sword] = on;
      }
    });
    G.LibSword.setGlobalOptions(options);
  }

  let html = '';
  let sep = '';
  mods.forEach((m) => {
    let h = '';
    try {
      h = G.LibSword.getDictionaryEntry(m, key);
    } catch (er) {
      h = '';
    }
    if (!h) {
      try {
        h = G.LibSword.getDictionaryEntry(m, key.toUpperCase());
      } catch (er) {
        h = '';
      }
    }
    if (h) h = markup2html(replaceLinks(h, m), m);
    if (mods.length === 1) {
      html += h;
    } else {
      html = html.replace(/^(<br>)+/, '');
      let dictTitle = G.LibSword.getModuleInformation(m, 'Description');
      dictTitle =
        dictTitle !== C.NOTFOUND
          ? `<div class="dict-description">${dictTitle}</div>`
          : '';
      html += sep + dictTitle + h;
      sep = `<div class="dict-sep"></div>`;
    }
  });
  if (!html) return '';

  // Add a heading
  html = `<div class="cs-${mods[0]}"><div class="dict-key-heading cd-${mods[0]}">${key}:</div>${html}</div>`;

  return html;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-continue */
import i18next from 'i18next';
import { ShowType } from '../../type';
import C from '../../constant';
import {
  dString,
  getElementInfo,
  getLocalizedChapterTerm,
  isASCII,
  sanitizeHTML,
} from '../../common';
import {
  findAVerseText,
  jsdump,
  parseLocation,
  ref2ProgramLocaleText,
} from '../rutil';
import G from '../rg';

function ascendingVerse(a: HTMLElement, b: HTMLElement) {
  const t1 = 'un';
  const t2 = 'fn';
  const t3 = 'cr';

  const pa = getElementInfo(a);
  const pb = getElementInfo(b);

  if (pa === null) return 1;
  if (pb === null) return -1;

  if (pa.ch === pb.ch) {
    if (pa.vs === pb.vs) {
      if (pa.ntype === pb.ntype) return 0;
      if (pa.ntype === t1) return -1;
      if (pa.ntype === t2 && pb.ntype === t3) return -1;
      return 1;
    }
    return (pa.vs || 0) > (pb.vs || 0) ? 1 : -1;
  }

  if ((pa.ch || 0) < (pb.ch || 0)) return -1;

  return 1;
}

// Looks for a "." delineated OSIS Scripture reference, checks, and normalizes it.
// Reads any osisRef target:ref and returns mod=null if it's not installed.
// Returns null if this is not an OSIS type reference.
// Converts book.c to book.c.vfirst-book.c.vlast
// And returns one of the following forms:
// a)   book.c.v
// b)   book.c.v-book.c.v
function normalizeOsisReference(refx: string, bibleMod: string) {
  let ref = refx;

  const ret = { mod: bibleMod as string | null, ref: null as string | null };
  if (ref.search('null') !== -1) return ret;

  ref = ref.replace(/^\s+/, ''); // remove beginning white space
  ref = ref.replace(/\s+$/, ''); // remove trailing white space

  // does osisRef have a target module?
  const tm = ref.match(/^(\w+):/);
  if (tm) {
    const [, m] = tm;
    ref = ref.replace(/^\w+:/, '');

    if (!/Bible/i.test(m)) {
      if (ret.mod && ret.mod in G.Tab && m in G.Tab) {
        ref = G.LibSword.convertLocation(
          G.LibSword.getVerseSystem(m),
          ref,
          G.LibSword.getVerseSystem(ret.mod)
        );
      } else if (m in G.Tab) ret.mod = m;
      else {
        ret.mod = null;
        jsdump('WARN: Target module is not installed!');
      }
    }
  }

  if (/^[^.]+\.\d+$/.test(ref)) {
    // bk.c
    if (ret.mod)
      ret.ref = `${ref}.1-${ref}.${G.LibSword.getMaxVerse(ret.mod, ref)}`;
    else ret.ref = ref;
  }

  if (/^[^.]+\.\d+\.\d+$/.test(ref))
    // bk.c.v
    ret.ref = ref;

  if (/^[^.]+\.\d+\.\d+\.\d+$/.test(ref)) {
    // bk.c.v1.v2
    const p = ref.match(/^(([^.]+\.\d+)\.\d+)\.(\d+)$/);
    if (p) ret.ref = `${p[1]}-${p[2]}.${p[3]}`;
  }

  if (/^[^.]+\.\d+\.\d+-\d+$/.test(ref)) {
    // bk.c.v1-v2
    const p = ref.match(/(^[^.]+\.\d+\.)(\d+)-(\d+)$/);
    if (p) ret.ref = `${p[1]}${p[2]}-${p[1]}${p[3]}`;
  }

  if (/^[^.]+\.\d+\.\d+-[^.]+\.\d+\.\d+$/.test(ref))
    // bk.c.v-bk.c.v
    ret.ref = ref;

  return ret;
}

// Turns headings on before reading introductions
function getIntroductions(mod: string, vkeytext: string) {
  if (
    !(mod in G.Tab) ||
    (G.Tab[mod].modType !== C.BIBLE && G.Tab[mod].modType !== C.COMMENTARY)
  ) {
    return { textHTML: '', intronotes: '' };
  }

  G.LibSword.setGlobalOption('Headings', 'On');

  const intro = G.LibSword.getIntroductions(mod, vkeytext);
  const notes = G.LibSword.getNotes();

  const x = G.Prefs.getBoolPref('xulsword.show.headings') ? 1 : 0;
  G.LibSword.setGlobalOption('Headings', C.SwordFilterValues[x]);
  return { textHTML: intro, intronotes: notes };
}

export function getChapterHeading(props: typeof C.LibSwordProps) {
  let l = G.ModuleConfigs[props.module]?.AssociatedLocale;
  if (!l || l === C.NOTFOUND) l = i18next.language; // otherwise use current program locale
  const toptions = { lng: l, ns: 'common/books' };

  const intro = getIntroductions(
    props.module,
    `${props.book} ${props.chapter}`
  );
  if (
    !intro.textHTML ||
    intro.textHTML.length < 10 ||
    /^\s*$/.test(intro.textHTML.replace(/<[^>]*>/g, ''))
  )
    intro.textHTML = '';

  // MAJOR CLUDGE! All this string processing should be replaced by DOM instructions. As it is now,
  // if any portion of HTML returned by LibSword is not well-formed, then the entire page is broken.
  // Setting intro (which is not well-formed for all RusVZh chapters) to an element and reading again
  // insures HTML string is well formed at least.
  if (intro.textHTML) {
    const tmp = document.createElement('div');
    sanitizeHTML(tmp, intro.textHTML);
    intro.textHTML = tmp.innerHTML;
  }

  let lt = G.LibSword.getModuleInformation(props.module, 'NoticeLink');
  if (lt === C.NOTFOUND) lt = '';
  else lt = lt.replace('<a>', "<a class='noticelink'>");

  // Chapter heading has style of the locale associated with the module, or else
  // current program locale if no associated locale is installed. But notice-link
  // is always cs-module style.
  let html = `<div class="chapterhead${
    props.chapter === 1 ? ' chapterfirst' : ''
  } cs-${l}">`;

  html += `<div class="chapnotice cs-${props.module}${!lt ? ' empty' : ''}">`;
  html += `<div class="noticelink-c">${lt}</div>`;
  html += '<div class="noticetext">'; // contains a span with class cs-mod because LibSword.getModuleInformation doesn't supply the class
  html += `<div class="cs-${props.module}">${
    lt ? G.LibSword.getModuleInformation(props.module, 'NoticeText') : ''
  }</div>`;
  html += '</div>';
  html += '<div class="head-line-break"></div>';
  html += '</div>';

  html += '<div class="chaptitle" >';
  html += `<div class="chapbk">${i18next.t(props.book, toptions)}</div>`;
  html += `<div class="chapch">${getLocalizedChapterTerm(
    props.book,
    props.chapter,
    l
  )}</div>`;
  html += '</div>';

  html += '<div class="chapinfo">';
  html += `<div class="listenlink" title="${[
    props.book,
    props.chapter,
    1,
    props.module,
  ].join('.')}"></div>`;
  html += `<div class="introlink${!intro.textHTML ? ' empty' : ''}" title="${[
    props.book,
    props.chapter,
    1,
    props.module,
  ].join('.')}">${i18next.t('IntroLink', toptions)}</div>`;
  /*
  if (props.ilModuleOption.length > 1) {
    html += '<div class="origselect">';
    html += '<select>';
    props.ilModuleOption.forEach((m) => {
      const selected = m === props.ilModule;
      html += `<option class="origoption cs-${G.Tab[m].locName}" value="${
        props.book
      }.1.1.${m}"${selected ? ' selected="selected"' : ''}>${
        G.Tab[m].label
      }</option>`;
    });
    html += '</select>';
    html += '</div>';
  } */
  html += '</div>';

  html += '</div>';

  html += '<div class="head-line-break"></div>';

  html += `<div class="introtext${!intro.textHTML ? ' empty' : ''}" title="${[
    props.book,
    props.chapter,
    1,
    props.module,
  ].join('.')}">${intro.textHTML ? intro.textHTML : ''}</div>`;

  return { textHTML: html, intronotes: intro.intronotes };
}

// This function tries to read a ";" separated list of Scripture
// references and return HTML which describes the references and their
// texts. It looks for OSIS type references as well as free
// hand references which may include ","s. It will supply missing
// book, chapter, and verse information using context and/or
// previously read information (as is often the case after a ",").
// This function also may look through multiple Bible texts until it
// finds the passage. It also takes care of verse system
// conversions (KJV and Synodal only, right now).
function getRefHTML(
  w: number,
  mod: string,
  body: string,
  keepTextNotes: boolean
) {
  const ref = body.split(/\s*;\s*/);

  // are there any commas? then add the sub refs to the list...
  for (let i = 0; i < ref.length; i += 1) {
    const verses = ref[i].split(/\s*,\s*/);
    if (verses.length !== 1) {
      let r = 1;
      for (let v = 0; v < verses.length; v += 1) {
        ref.splice(i + 1 - r, r, verses[v]);
        i += 1;
        i -= r;
        r = 0;
      }
    }
  }

  const tabs = G.Prefs.getComplexValue('xulsword.tabs');

  // set default starting values, which may be used to fill in missing
  // values which were intended to be assumed from context
  let bk = G.Prefs.getCharPref('xulsword.book') as string | null;
  let ch = G.Prefs.getIntPref('xulsword.chapter') as number | null;
  let vs = 1 as number | null;

  let html = '';
  let sep = '';
  for (let i = 0; i < ref.length; i += 1) {
    if (!ref[i]) continue;
    let failed = false;

    // is this a reference to a footnote?
    if (ref[i].indexOf('!') !== -1) {
      let footnote = '-----';

      const m = ref[i].match(/^\s*(([^:]+):)?([^!:]+)(!.*?)\s*$/);
      if (m) {
        const rmod = m[1] ? m[2] : mod;
        const rref = m[3];
        const ext = m[4];

        // find the footnote which is being referenced
        G.LibSword.getChapterText(rmod, rref);
        const noteContainer = document.createElement('div');
        sanitizeHTML(noteContainer, G.LibSword.getNotes());
        const notes = noteContainer.getElementsByClassName('nlist');

        for (let x = 0; x < notes.length; x += 1) {
          const osisID = notes[x].getAttribute('data-osisID');
          if (osisID && osisID === rref + ext) {
            footnote = notes[x].innerHTML;
            break;
          }
        }
      }

      html += sep;
      html += `<span class="fntext cs-${
        isASCII(footnote) ? C.DEFAULTLOCALE : mod
      }${
        G.ModuleConfigs[mod].direction !== G.ProgramConfig.direction
          ? ' opposing-program-direction'
          : ''
      }">${footnote}</span>`;
      sep = '<span class="cr-sep"></span>';

      continue;
    }

    // is this ref an osisRef type reference?
    let r = normalizeOsisReference(ref[i], mod);

    // if not, then parse it and fill in any missing values from context
    if (!r.ref) {
      const loc = parseLocation(ref[i], false, true);
      if (loc) {
        bk = loc.book || bk;
        ch = loc.chapter || ch;
        vs = loc.verse || vs;

        r.ref = `${bk}.${ch}.${vs}`;

        if (loc.lastverse) {
          r.ref += `-${bk}.${ch}.${loc.lastverse}`;
        }

        r = normalizeOsisReference(r.ref, mod);

        if (!r.ref) failed = true;
      } else failed = true;
    }
    if (failed) {
      // then reset our context, since we may have missed something along the way
      bk = null;
      ch = null;
      vs = null;
      continue;
    }
    let aVerse;
    if (r.mod && r.ref)
      aVerse = findAVerseText(r.mod, r.ref, tabs[w], keepTextNotes);
    if (!aVerse)
      aVerse = {
        text: `(${ref[i]} ??)`,
        location: r.ref,
        tabindex: G.Tab[mod].index,
      };
    if (/^\s*$/.test(aVerse.text)) aVerse.text = '-----';

    if (aVerse.location) {
      const rmod = G.Tabs[aVerse.tabindex].modName;
      html += sep;
      html += `<a class="crref" title="${aVerse.location}.${rmod}">`;
      html += ref2ProgramLocaleText(aVerse.location);
      html += '</a>';
      html += `<span class="crtext cs-${rmod}${
        G.ModuleConfigs[rmod].direction !== G.ProgramConfig.direction
          ? ' opposing-program-direction'
          : ''
      }">`;
      html += aVerse.text + (rmod !== mod ? ` (${G.Tab[rmod].label})` : '');
      html += '</span>';

      sep = '<span class="cr-sep"></span>';
    }
  }

  return html;
}

// The 'notes' argument can be HTML or a DOM element which is either a single
// note or a container with note child/children
export default function getNoteHTML(
  notes: string | HTMLDivElement,
  mod: string,
  show: ShowType,
  openCRs: boolean,
  wx: number,
  keepTextNotes: boolean
) {
  if (!notes) return '';

  const w = wx || 0; // w is only needed for unique id creation

  let noteContainer: HTMLDivElement;
  if (typeof notes === 'string') {
    noteContainer = document.createElement('div');
    sanitizeHTML(noteContainer, notes);
  } else if (notes.className === 'nlist') {
    noteContainer = document.createElement('div');
    noteContainer.appendChild(notes);
  } else noteContainer = notes;

  let note: any[] = [];
  const nodelist = noteContainer.getElementsByClassName('nlist');
  for (let n = 0; n < nodelist.length; n += 1) {
    note.push(nodelist[n]);
  }
  note = note.sort(ascendingVerse);

  // Start building our html
  let t = '';

  if (note) {
    // Now parse each note in the chapter separately
    for (let n = 0; n < note.length; n += 1) {
      const p = getElementInfo(note[n]);
      if (p) {
        let body = note[n].innerHTML;

        // Check if this note should be displayed, and if not then skip it
        const notetypes = { fn: 'footnotes', cr: 'crossrefs', un: 'usernotes' };
        Object.entries(notetypes).forEach((entry) => {
          const [ntype, tx] = entry;
          const type = tx as keyof ShowType;
          if (p.ntype === ntype && !show[type]) p.ntype = null;
        });
        if (p.ntype) {
          // Display this note as a row in the main table
          t += `<div id="w${w}.footnote.${p.title}" `;
          t += `title="${p.nid}.${p.bk}.${p.ch}.${p.vs}.${p.mod}" `;
          t += `class="fnrow ${openCRs ? 'cropened' : 'crclosed'}">`;

          // Write cell #1: an expander link for cross references only
          t += '<div class="fncol1">';
          if (p.ntype === 'cr') {
            t += '<div class="crtwisty"></div>';
          }
          t += '</div>';

          // These are the lines for showing expanded verse refs
          t += '<div class="fncol2"><div class="fndash"></div></div>';
          t += '<div class="fncol3">&nbsp;</div>';

          // Write cell #4: chapter and verse
          let lov = G.ModuleConfigs[mod].AssociatedLocale;
          if (lov === C.NOTFOUND) lov = i18next.language;
          const modDirectionEntity =
            G.ModuleConfigs[mod] && G.ModuleConfigs[mod].direction === 'rtl'
              ? '&rlm;'
              : '&lrm;';
          t += '<div class="fncol4">';
          if (p.ch && p.vs) {
            t += `<a class="fnlink" title="${p.nid}.${p.bk}.${p.ch}.${p.vs}.${p.mod}">`;
            t += `<i>${dString(p.ch, lov)}:${modDirectionEntity}${dString(
              p.vs,
              lov
            )}</i>`;
            t += '</a>';
            t += ' -';
          }
          t += '</div>';

          // Write cell #5: note body
          t += '<div class="fncol5">';

          switch (p.ntype) {
            case 'cr':
              // If this is a cross reference, then parse the note body for references and display them
              t += getRefHTML(w, mod, body, keepTextNotes);
              break;

            case 'fn':
              // If this is a footnote, then just write the body
              t += `<span class="fntext cs-${
                isASCII(body) ? C.DEFAULTLOCALE : mod
              }${
                G.ModuleConfigs[mod].direction !== G.ProgramConfig.direction
                  ? ' opposing-program-direction'
                  : ''
              }">${body}</span>`;
              break;

            case 'un': {
              // If this is a usernote, then add direction entities and style
              const unmod = null;
              /*
              try {
                unmod = BMDS.GetTarget(
                  BM.RDF.GetResource(decodeURIComponent(p.nid)),
                  BM.gBmProperties[C.NOTELOCALE],
                  true
                );
                unmod = unmod.QueryInterface(
                  Components.interfaces.nsIRDFLiteral
                ).Value;
              } catch (er) {}
              */
              const de =
                unmod && G.ModuleConfigs[unmod]?.direction === 'rtl'
                  ? '&rlm;'
                  : '&lrm;';
              body = `<span class="noteBoxUserNote${
                unmod ? ` cs-${unmod}` : ''
              }">${de}${body}${de}</span>`;
              t += body;
              break;
            }
            default:
          }

          // Finish this body and this row
          t += '</div>';
          t += '</div>';
        }
      }
    }

    // Finish html
    if (t) t = `<div class="fntable">${t}</div>`;
  }

  return t;
}

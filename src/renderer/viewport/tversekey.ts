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
  ofClass,
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
          G.Tab[m].v11n,
          ref,
          G.Tab[ret.mod].v11n
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
  if (!(mod in G.Tab) || G.Tab[mod].isVerseKey) {
    return { textHTML: '', intronotes: '' };
  }

  G.LibSword.setGlobalOption('Headings', 'On');

  const intro = G.LibSword.getIntroductions(mod, vkeytext);
  const notes = G.LibSword.getNotes();

  const x = G.Prefs.getBoolPref('xulsword.show.headings') ? 1 : 0;
  G.LibSword.setGlobalOption('Headings', C.SwordFilterValues[x]);
  return { textHTML: intro, intronotes: notes };
}

export function getChapterHeading(props: {
  book: string | undefined;
  chapter: number | undefined;
  module: string | undefined;
}) {
  if (!props.book || !props.chapter || !props.module)
    return { textHTML: '', intronotes: '' };
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
      const rmod = G.Tabs[aVerse.tabindex].module;
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
export function getNoteHTML(
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
  }

  return t;
}

// returns true if velem is a visible verse element in window w, false otherwise
function verseIsVisible(
  v: HTMLElement,
  sbe: HTMLElement,
  nbe: HTMLElement,
  columns: number,
  module: string
): boolean {
  // return false if we're not a verse
  if (!v?.classList?.contains('vs')) return false;

  // return false if we're not visible or being displayed
  const style = window.getComputedStyle(v);
  if (style.display === 'none' || style.visibility === 'hidden') return false;

  // return false if we're not in atext
  const atext = ofClass('atext', sbe);
  if (!atext) return false;
  const t = atext.element;
  let test = v as HTMLElement | null;
  while (test && test !== t) {
    test = test.parentNode as HTMLElement | null;
  }
  if (!test) return false;

  // are we a single column window?
  if (columns === 1) {
    return (
      v.offsetTop - sbe.offsetTop >= sbe.scrollTop &&
      v.offsetTop - sbe.offsetTop < sbe.scrollTop + sbe.offsetHeight - 30
    );
  }

  const nbep = nbe.parentNode as HTMLElement;

  // multi-column windows...
  if (G.ModuleConfigs[module].direction === 'ltr') {
    // we are LTR
    // are we outside the visible columns?
    if (v.offsetLeft > sbe.offsetWidth) return false;

    // are we in the last visible column but under the footnote box?
    if (
      v.offsetLeft > sbe.offsetWidth - 1.1 * nbe.offsetWidth &&
      v.offsetTop + v.offsetHeight > t.offsetHeight - nbep.offsetHeight
    ) {
      return false;
    }

    // then we must be visible
    return true;
  }

  // we are RTL
  // are we outside the visible columns?
  if (v.offsetLeft < 0) return false;

  // are we in the last visible column but under the footnote box?
  if (
    v.offsetLeft < 0.9 * nbe.offsetWidth &&
    v.offsetTop + v.offsetHeight > t.offsetHeight - nbep.offsetHeight
  ) {
    return false;
  }

  // then we must be visible
  return true;
}

export function scroll(
  sbe: HTMLElement,
  nbe: HTMLElement,
  scrollProps: {
    book: string;
    chapter: number;
    verse: number;
    lastverse: number;
    flagHilight: number;
    flagScroll: number;
  },
  columns: number,
  module: string
) {
  const { book, chapter, verse, flagScroll } = scrollProps;

  sbe.scrollLeft = 0; // commentary may have been non-zero

  // find the element to scroll to
  let av = sbe.firstChild as ChildNode | null;
  let v = null as HTMLElement | null;
  let vf = null;
  while (av && !v) {
    const p = getElementInfo(av as HTMLElement);
    if (p !== null && p.type === 'vs') {
      if (!vf && p.bk === book && p.ch === chapter) vf = av as HTMLElement;
      if (
        p.bk === book &&
        p.ch === chapter &&
        p.vs &&
        p.lv &&
        verse >= p.vs &&
        verse <= p.lv
      )
        v = av as HTMLElement;
    }
    av = av.nextSibling;
  }

  // if not found, use first verse in current chapter
  if (!v) v = vf;

  // if neither verse nor chapter has been found, return null
  if (!v) return null;

  // perform appropriate scroll action
  let vOffsetTop = v.offsetTop;
  let vt = v as HTMLElement | null;
  while (vt && vt.parentNode !== v.offsetParent) {
    vt = vt.parentNode as HTMLElement | null;
    if (vt && vt.offsetTop) vOffsetTop -= vt.offsetTop;
  }

  let flagScroll2 = flagScroll;
  // some special rules for commentaries
  if (G.Tab[module].type === C.COMMENTARY) {
    // if part of commentary element is already visible, don't rescroll
    if (
      vOffsetTop < sbe.scrollTop &&
      vOffsetTop + v.offsetHeight > sbe.scrollTop + 20
    ) {
      return null;
    }

    // commentaries should never scroll verse to middle, only to top
    if (
      flagScroll === C.SCROLLTYPECENTER ||
      flagScroll === C.SCROLLTYPECENTERALWAYS
    )
      flagScroll2 = C.SCROLLTYPEBEG;
  }

  // if this is verse 1 then SCROLLTYPEBEG and SCROLLTYPECENTER both become SCROLLTYPECHAP
  if (
    verse === 1 &&
    (flagScroll2 === C.SCROLLTYPEBEG || flagScroll2 === C.SCROLLTYPECENTER)
  ) {
    flagScroll2 = C.SCROLLTYPECHAP;
  }

  // scroll single column windows...
  if (columns === 1) {
    switch (flagScroll2) {
      // don't scroll (for links this becomes SCROLLTYPECENTER)
      case C.SCROLLTYPENONE:
        break;
      // scroll to top
      case C.SCROLLTYPECHAP:
        sbe.scrollTop = 0;
        break;
      // put selected verse at the top of the window or link
      case C.SCROLLTYPEBEG:
        sbe.scrollTop = vOffsetTop;
        break;
      // put selected verse in the middle of the window or link, unless verse is already entirely visible or verse 1
      case C.SCROLLTYPECENTER:
        if (
          verse !== 1 &&
          (vOffsetTop + v.offsetHeight > sbe.scrollTop + sbe.offsetHeight ||
            vOffsetTop < sbe.scrollTop)
        ) {
          const middle = Math.round(
            vOffsetTop - sbe.offsetHeight / 2 + v.offsetHeight / 2
          );
          // if beginning of verse is not showing then make it show
          if (vOffsetTop < middle) {
            sbe.scrollTop = vOffsetTop;
          } else {
            sbe.scrollTop = middle;
          }
        }
        break;
      // put selected verse in the middle of the window or link, even if verse is already visible or verse 1
      case C.SCROLLTYPECENTERALWAYS: {
        const middle = Math.round(
          vOffsetTop - sbe.offsetHeight / 2 + v.offsetHeight / 2
        );
        if (vOffsetTop < middle) {
          sbe.scrollTop = vOffsetTop;
        } else {
          sbe.scrollTop = middle;
        }
        break;
      }
      // put selected verse at the end of the window or link, and don't change selection
      case C.SCROLLTYPEEND:
        sbe.scrollTop = vOffsetTop + v.offsetHeight - sbe.offsetHeight;
        break;
      // put selected verse at the end of the window or link, then select first verse of link or verse 1
      case C.SCROLLTYPEENDSELECT:
        sbe.scrollTop = vOffsetTop + v.offsetHeight - sbe.offsetHeight;
        // set Location to first visible verse- not implemented because not yet used
        break;
      default:
        throw Error(`Unsupported flagScroll "${flagScroll2}"`);
    }
  }

  // or scroll multi-column windows...
  else if (
    !(
      flagScroll2 === C.SCROLLTYPECENTER &&
      (verse === 1 || verseIsVisible(v, sbe, nbe, columns, module))
    )
  ) {
    switch (flagScroll2) {
      // scroll to top
      case C.SCROLLTYPECHAP: {
        // hide all verses previous to scroll verse's chapter
        let vs = sbe.lastChild as HTMLElement | null;
        let show = true;
        while (vs) {
          const p = getElementInfo(vs);
          if (p && p.type === 'vs' && p.ch === chapter - 1) show = false;
          // must always check for (vs.style) because pre-verse titles
          // may begin with a Text node which will not have a style prop.
          if (vs.style) vs.style.display = show ? '' : 'none';
          vs = vs.previousSibling as HTMLElement | null;
        }
        break;
      }
      // put selected verse at the top of the window or link
      case C.SCROLLTYPEBEG: {
        // Hide all verses before the scroll verse. If the scroll verse is immediately preceded by
        // consecutive non-verse (heading) elements, then show them.
        let vs = sbe.lastChild as HTMLElement | null;
        let show = true;
        let showhead = true;
        while (vs) {
          if (!show && showhead) {
            const p = getElementInfo(vs);
            const isverse = p && p.type === 'vs';
            if (vs.style) vs.style.display = isverse ? 'none' : '';
            if (isverse) showhead = false;
          } else {
            if (vs.style) vs.style.display = show ? '' : 'none';
            if (vs === v) show = false;
          }
          vs = vs.previousSibling as HTMLElement | null;
        }
        break;
      }
      case C.SCROLLTYPENONE: // don't scroll (for links this becomes SCROLLTYPECENTER)
      case C.SCROLLTYPECENTER: // put selected verse in the middle of the window or link, unless verse is already entirely visible or verse 1
      case C.SCROLLTYPECENTERALWAYS: {
        // put selected verse in the middle of the window or link, even if verse is already visible or verse 1
        // hide all elements before verse
        let vs = sbe.firstChild as HTMLElement | null;
        let show = false;
        while (vs) {
          if (vs === v) show = true;
          if (vs.style) vs.style.display = show ? '' : 'none';
          vs = vs.nextSibling as HTMLElement | null;
        }
        // show verse near middle of first column
        vs = v.previousSibling as HTMLElement | null;
        if (vs) {
          let h = 0;
          do {
            if (vs.style) vs.style.display = '';
            if (vs.offsetHeight) h += vs.offsetHeight;
            vs = vs.previousSibling as HTMLElement | null;
          } while (vs && h < sbe.offsetHeight / 2 - 20);
          if (vs && vs.style) vs.style.display = 'none';
        }
        break;
      }
      // put selected verse at the end of the window or link, and don't change selection
      case C.SCROLLTYPEEND:
      case C.SCROLLTYPEENDSELECT: {
        // put selected verse at the end of the window or link, then select first verse of link or verse 1
        // show all verses
        let vs = sbe.lastChild as HTMLElement | null;
        while (vs) {
          if (vs.style) vs.style.display = '';
          vs = vs.previousSibling as HTMLElement | null;
        }
        // hide verses until last verse is visible
        vs = sbe.firstChild as HTMLElement | null;
        while (vs && !verseIsVisible(v, sbe, nbe, columns, module)) {
          if (vs.style) vs.style.display = 'none';
          vs = vs.nextSibling as HTMLElement | null;
        }

        if (flagScroll2 === C.SCROLLTYPEENDSELECT) {
          vs = sbe.firstChild as HTMLElement | null;
          while (vs) {
            const p = getElementInfo(vs);
            if (
              p &&
              p.type === 'vs' &&
              vs.style &&
              vs.style.display !== 'none'
            ) {
              return {
                book: p.bk,
                chapter: Number(p.ch),
                verse: Number(p.vs),
                lastverse: Number(p.vs),
              };
            }
            vs = vs.nextSibling as HTMLElement | null;
          }
        }
        break;
      }
      default:
    }
  }

  return null;
}

export function highlight(
  sbe: HTMLElement,
  scrollProps: {
    book: string;
    chapter: number;
    verse: number;
    lastverse: number;
    flagHilight: number;
    flagScroll: number;
  }
) {
  const { book, chapter, verse, lastverse, flagHilight } = scrollProps;
  if (flagHilight === C.HILIGHTSKIP) return;

  // unhilight everything
  Array.from(sbe.getElementsByClassName('hl')).forEach((v) => {
    v.classList.remove('hl');
  });

  // find the verse element(s) to highlight
  let av = sbe.firstChild as HTMLElement | null;
  while (av) {
    const v = getElementInfo(av);
    if (v && v.type === 'vs') {
      let hi = v.bk === book && v.ch === chapter;
      if (flagHilight === C.HILIGHTNONE) hi = false;
      if (
        flagHilight === C.HILIGHT_IFNOTV1 &&
        (verse === 1 || !v.lv || !v.vs || v.lv < verse || v.vs > lastverse)
      )
        hi = false;
      if (
        flagHilight === C.HILIGHTVERSE &&
        (!v.lv || !v.vs || v.lv < verse || v.vs > lastverse)
      )
        hi = false;

      if (hi) av.classList.add('hl');
    }

    av = av.nextSibling as HTMLElement | null;
  }
}

export function trimNotes(
  sbe: HTMLElement,
  nbe: HTMLElement,
  module: string
): boolean {
  let havefn = false;

  // get first chapter/verse
  let vf = sbe.firstChild as HTMLElement | null;
  while (vf && !verseIsVisible(vf, sbe, nbe, 2, module)) {
    vf = vf.nextSibling as HTMLElement | null;
  }

  // get last chapter/verse
  let vl = sbe.lastChild as HTMLElement | null;
  while (vl && !verseIsVisible(vl, sbe, nbe, 2, module)) {
    vl = vl.previousSibling as HTMLElement | null;
  }

  const f = vf ? getElementInfo(vf) : null;
  const l = vl ? getElementInfo(vl) : null;

  // hide footnotes whose references are scrolled off the window
  if (nbe.innerHTML) {
    const nt = Array.from(nbe.getElementsByClassName('fnrow')) as HTMLElement[];
    nt.forEach((nti) => {
      const v = getElementInfo(nti);
      if (v) {
        let display = '';
        if (
          f &&
          v.ch &&
          f.ch &&
          v.vs &&
          f.vs &&
          (v.ch < f.ch || (v.ch === f.ch && v.vs < f.vs))
        )
          display = 'none';
        if (
          l &&
          vl &&
          v.ch &&
          l.ch &&
          v.vs &&
          l.vs &&
          (v.ch > l.ch || (v.ch === l.ch && v.vs > l.vs))
        )
          display = 'none';
        nti.style.display = display;
        if (display !== 'none') havefn = true;
      }
    });
  }

  return havefn;
}

export function findVerseElement(
  sbe: HTMLElement,
  chapter: number,
  verse: number
): HTMLElement | null {
  let c = sbe.firstChild as HTMLElement | null;
  while (c) {
    if (c.classList?.contains('vs') && 'title' in c) {
      const [, ch, vs] = c.title.split('.');
      if (Number(ch) === chapter && Number(vs) === verse) {
        return c;
      }
    }
    c = c.nextSibling as HTMLElement | null;
  }
  return null;
}

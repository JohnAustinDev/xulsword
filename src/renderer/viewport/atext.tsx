/* eslint-disable react/forbid-prop-types */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import i18next from 'i18next';
import {
  PlaceType,
  ShowType,
  SwordFilterType,
  SwordFilterValueType,
} from '../../type';
import C from '../../constant';
import {
  compareObjects,
  dString,
  sanitizeHTML,
  stringHash,
} from '../../common';
import G from '../rg';
import {
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  xulClass,
  handle,
} from '../libxul/xul';
import { Vbox, Hbox, Box } from '../libxul/boxes';
// eslint-disable-next-line import/no-cycle
import {
  getNoteHTML,
  getChapterHeading,
  highlight,
  scroll,
  trimNotes,
  findVerseElement,
} from './zversekey';
// eslint-disable-next-line import/no-cycle
import handlerH from './atextH';
import '../libxul/xul.css';
import '../libsword.css';
import './atext.css';
import { getDictEntryHTML, getDictSortedKeyList } from './zdictionary';

const memoize = require('memoizee');

const defaultProps = {
  ...xulDefaultProps,
  anid: undefined,
  ownWindow: false,
};

const propTypes = {
  ...xulPropTypes,
  xulswordHandler: PropTypes.func.isRequired,
  anid: PropTypes.string,
  n: PropTypes.number.isRequired,
  columns: PropTypes.number.isRequired,
  book: PropTypes.string.isRequired,
  chapter: PropTypes.number.isRequired,
  verse: PropTypes.number.isRequired,
  module: PropTypes.string,
  ilModule: PropTypes.string,
  ilModuleOption: PropTypes.arrayOf(PropTypes.string).isRequired,
  modkey: PropTypes.string.isRequired,
  selection: PropTypes.string,
  flagScroll: PropTypes.number.isRequired,
  isPinned: PropTypes.bool.isRequired,
  noteBoxHeight: PropTypes.number.isRequired,
  maximizeNoteBox: PropTypes.number.isRequired,
  show: PropTypes.object.isRequired,
  place: PropTypes.object.isRequired,
  ownWindow: PropTypes.bool,
  versification: PropTypes.string,
};

// TODO! wheel-scroll all windows together, popup blocks wheelscroll

// Atext's properties. NOTE: property types are checked, but property values are not.
const atextProps = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  xulswordHandler: (
    _e: React.SyntheticEvent<any>,
    _noteboxResizing?: number[],
    _maximize?: boolean
  ): void => {},
  anid: '',
  n: 0,
  columns: 0,
  book: '',
  chapter: 0,
  verse: 0,
  module: '' as string | undefined,
  ilModule: '' as string | undefined,
  ilModuleOption: [] as string[],
  modkey: '',
  selection: '' as string | undefined,
  flagScroll: 0,
  isPinned: false,
  noteBoxHeight: 0,
  maximizeNoteBox: 0,
  show: {} as ShowType,
  place: {} as PlaceType,
  ownWindow: false,
  versification: '' as string | undefined, // v11n of the viewport (not necessarily of the text)
};

export type AtextProps = XulProps & typeof atextProps;

type LibSwordResponse = {
  textHTML: string;
  noteHTML: string;
  notes: string;
  intronotes: string;
};

export interface AtextState {
  pin: typeof C.PinProps | null;
  versePerLine: boolean;
  noteBoxResizing: number[] | null;
}

// XUL Atext
class Atext extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  static cache: any;

  static libswordResponseMemoized: (
    props: AtextProps,
    n: number
  ) => LibSwordResponse;

  static cacheReset() {
    Atext.cache = { keyList: [], keyHTML: [] };
  }

  static copyProps(source: any, which: any) {
    const p: any = {};
    Object.keys(which).forEach((k) => {
      p[k] = k in source ? source[k] : undefined;
    });
    return p;
  }

  static libswordResponse(props: AtextProps, n: number): LibSwordResponse {
    const { module, ilModule, book, chapter, modkey, place, show } = props;

    const r = {
      headHTML: '',
      textHTML: '',
      noteHTML: '',
      notes: '',
      intronotes: '',
    };

    if (!module) return r;

    const { type } = G.Tab[module];
    let moduleLocale = G.ModuleConfigs[module].AssociatedLocale;
    if (moduleLocale === C.NOTFOUND) moduleLocale = '';

    // Set SWORD filter options
    const options = {} as { [key in SwordFilterType]: SwordFilterValueType };
    Object.entries(C.SwordFilters).forEach((entry) => {
      const sword = entry[0] as SwordFilterType;
      let showi = show[entry[1]] ? 1 : 0;
      if (C.AlwaysOn[type].includes(sword)) showi = 1;
      options[sword] = C.SwordFilterValues[showi];
    });
    if (ilModule) {
      const [, on] = C.SwordFilterValues;
      options["Strong's Numbers"] = on;
      options['Morphological Tags'] = on;
    }
    G.LibSword.setGlobalOptions(options);

    // Read Libsword according to module type
    switch (type) {
      case C.BIBLE: {
        if (ilModule) {
          r.textHTML += G.LibSword.getChapterTextMulti(
            `${module},${ilModule}`,
            `${book}.${chapter}`
          ).replace(/interV2/gm, `cs-${ilModule}`);
        } else {
          r.textHTML += G.LibSword.getChapterText(module, `${book}.${chapter}`);
          r.notes += G.LibSword.getNotes();
        }
        break;
      }
      case C.COMMENTARY: {
        r.textHTML += G.LibSword.getChapterText(module, `${book}.${chapter}`);
        r.notes += G.LibSword.getNotes();
        break;
      }
      case C.DICTIONARY: {
        // For dictionaries, noteHTML is a key selector. Cache both
        // the keyList and the key selector for a big speedup.
        if (!Atext.cache.keyList || !(module in Atext.cache.keyList)) {
          let list = G.LibSword.getAllDictionaryKeys(module).split('<nx>');
          list.pop();
          const sort = G.LibSword.getModuleInformation(module, 'KeySort');
          if (sort !== C.NOTFOUND) {
            list = getDictSortedKeyList(list, `${sort}0123456789`);
          }
          Atext.cache.keyList[module] = list;
        }

        // Get the actual key.
        let key = modkey;
        if (!key) [key] = Atext.cache.keyList[module];
        if (key === 'DailyDevotionToday') {
          const today = new Date();
          const mo = today.getMonth() + 1;
          const dy = today.getDate();
          key = `${mo < 10 ? '0' : ''}${String(mo)}.${dy < 10 ? '0' : ''}${dy}`;
        }

        // Build and cache the selector list.
        if (!Atext.cache.keyHTML || !(module in Atext.cache.keyHTML)) {
          let html = '';
          Atext.cache.keyList[module].forEach((k1: any) => {
            const k2 = encodeURIComponent(k1);
            html += `<div class="key ${k2} title="${k2}">${k1}</div>`;
          });
          Atext.cache.keyHTML[module] = html;
        }

        // Return the results
        r.textHTML += `<div class="dictentry">${getDictEntryHTML(
          key,
          module,
          true
        )}</div>`;

        r.noteHTML += `<div class="dictlist">
            <div class="textboxparent"><input type="text" value="${key}" class="cs-${module} keytextbox"/ ></div>
            <div class="keylist">${Atext.cache.keyHTML[module]}</div>
          </div>`;
        break;
      }
      case C.GENBOOK: {
        r.textHTML += G.LibSword.getGenBookChapterText(module, modkey);
        break;
      }
      default:
    }

    // Add usernotes to text
    if (props.show.usernotes) Atext.addUserNotes(r, props);

    // handle footnotes.
    // NOTE: This step is by far the slowest part of Atext render,
    // particularly when crossrefs include many links.
    if (G.Tab[module].isVerseKey) {
      const notetypes: (keyof PlaceType)[] = [
        'footnotes',
        'crossrefs',
        'usernotes',
      ];
      const shownb: any = {};
      notetypes.forEach((nt) => {
        shownb[nt] = show[nt] && place[nt] === 'notebox';
      });
      if (
        Object.keys(shownb).some((s) => {
          return shownb[s];
        })
      )
        r.noteHTML += getNoteHTML(r.notes, module, shownb, n);
    }

    // Localize verse numbers to match the module
    if (
      G.Tab[module].isVerseKey &&
      moduleLocale &&
      dString(1, moduleLocale) !== dString(1, 'en')
    ) {
      const verseNm = new RegExp('(<sup class="versenum">)(\\d+)(</sup>)', 'g');
      r.textHTML = r.textHTML.replace(verseNm, (_str, p1, p2, p3) => {
        return p1 + dString(p2, moduleLocale) + p3;
      });
    }

    // Add chapter heading and intronotes
    if (G.Tab[module].isVerseKey && show.headings && r.textHTML) {
      const headInfo = getChapterHeading(props);
      r.textHTML = headInfo.textHTML + r.textHTML;
      r.intronotes = headInfo.intronotes;
    }

    return r;
  }

  static addUserNotes(content: LibSwordResponse, props: AtextProps) {}

  handler: (e: React.SyntheticEvent) => void;

  mouseWheel: { TO: number; atext: HTMLElement | null; count: number };

  sbref: React.RefObject<HTMLDivElement>;

  nbref: React.RefObject<HTMLDivElement>;

  notes: string;

  intronotes: string;

  constructor(props: AtextProps) {
    super(props);

    this.state = {
      pin: null,
      versePerLine: false,
      noteBoxResizing: null,
    };

    this.mouseWheel = { TO: 0, atext: null, count: 0 };

    this.sbref = React.createRef();

    this.nbref = React.createRef();

    this.notes = '';

    this.intronotes = '';

    this.handler = handlerH.bind(this);
    this.bbMouseUp = this.bbMouseUp.bind(this);
    this.onUpdate = this.onUpdate.bind(this);
    this.writeLibSword2DOM = this.writeLibSword2DOM.bind(this);
  }

  componentDidMount() {
    this.onUpdate();
  }

  componentDidUpdate() {
    this.onUpdate();
  }

  // Check if sb already contains the necessary LibSword response
  // and if not, memoize the required response(s) and update sb
  // contents. Do any srolling, highlighting or footnote adjustments.
  // NOTE: the related hashes must be stored on the sb HTML element
  // itself, because the sb element may be silently replaced by React
  // and storing it there insures the hashes are invalidated at the
  // same time.
  //
  // Also update pin state whenever it changes.
  onUpdate() {
    const props = this.props as AtextProps;
    const state = this.state as AtextState;
    const { columns, isPinned, n, versification } = props;
    const { pin } = state as AtextState;
    const { sbref, nbref } = this;

    const sbe = sbref !== null ? sbref.current : null;
    const nbe = nbref !== null ? nbref.current : null;

    let newState = {};
    const newPin = Atext.copyProps(pin && isPinned ? pin : props, C.PinProps);
    const { book, verse, selection, module } = newPin;
    if (!compareObjects(newPin, pin)) newState = { ...newState, pin: newPin };
    if (module && sbe && nbe) {
      const { type, isVerseKey } = G.Tab[module];
      const newLibSword = Atext.copyProps(
        {
          ...props,
          ...newPin,
        },
        C.LibSwordProps[type]
      );
      const newScroll = Atext.copyProps(
        { ...props, ...newPin },
        C.ScrollProps[type]
      );
      const writekey = stringHash({ ...newLibSword, chapter: 0 }, n);
      const scrollkey = stringHash(newScroll);
      // Overwrite current innerHTML if needed
      let update = false;
      if (!isVerseKey) {
        update = writekey !== sbe.dataset.libsword;
        if (update) this.writeLibSword2DOM(newLibSword, n, 'overwrite');
      } else {
        let chfirst;
        let chlast;
        if ('chfirst' in sbe.dataset) chfirst = Number(sbe.dataset.chfirst);
        if ('chlast' in sbe.dataset) chlast = Number(sbe.dataset.chlast);
        if (
          !(
            chfirst &&
            chlast &&
            newLibSword.chapter >= chfirst &&
            newLibSword.chapter <= chlast
          ) ||
          chlast - chfirst > 10 ||
          writekey !== sbe.dataset.libsword
        ) {
          update = true;
          this.writeLibSword2DOM(newLibSword, n, 'overwrite');
          chfirst = Number(sbe.dataset.chfirst);
          chlast = Number(sbe.dataset.chlast);
        }
        // Prepare for Bible column scrolling if needed
        if (
          newScroll.flagScroll !== C.SCROLLTYPENONE &&
          (update || scrollkey !== sbe.dataset.scroll) &&
          type === C.BIBLE &&
          columns > 1 &&
          chfirst &&
          chlast
        ) {
          const rtl = G.ModuleConfigs[module].direction === 'rtl';
          let v = findVerseElement(sbe, newLibSword.chapter, verse);
          if (v) v.style.display = '';
          let sib = v?.previousSibling as HTMLElement | null;
          while (
            v &&
            sib &&
            ((!rtl && v.offsetLeft < sbe.offsetWidth) ||
              (rtl && v.offsetLeft >= 0))
          ) {
            if (sib.style && sib.style.display === 'none')
              sib.style.display = '';
            sib = sib.previousSibling as HTMLElement | null;
          }
          while (
            chfirst >= 2 &&
            v &&
            ((!rtl && v.offsetLeft < sbe.offsetWidth) ||
              (rtl && v.offsetLeft >= 0))
          ) {
            update = true;
            this.writeLibSword2DOM(newLibSword, n, 'prepend');
            v = findVerseElement(sbe, newLibSword.chapter, verse);
            chfirst -= 1;
          }
          const max = G.LibSword.getMaxChapter(module, book);
          let last = sbe.lastChild as HTMLElement | null;
          sib = v?.nextSibling as HTMLElement | null;
          while (
            sib &&
            v &&
            last &&
            ((!rtl && last.offsetLeft - v.offsetLeft < sbe.offsetWidth) ||
              (rtl && last.offsetLeft - v.offsetLeft >= 0))
          ) {
            if (sib.style && sib.style.display === 'none')
              sib.style.display = '';
            sib = sib.nextSibling as HTMLElement | null;
          }
          while (
            chlast < max &&
            v &&
            last &&
            ((!rtl && last.offsetLeft - v.offsetLeft < sbe.offsetWidth) ||
              (rtl && last.offsetLeft - v.offsetLeft >= 0))
          ) {
            update = true;
            this.writeLibSword2DOM(newLibSword, n, 'append');
            v = findVerseElement(sbe, newLibSword.chapter, verse);
            last = sbe.lastChild as HTMLElement | null;
            chlast += 1;
          }
        }
      }
      // Scroll if needed
      if (
        newScroll.flagScroll !== C.SCROLLTYPENONE &&
        (update || scrollkey !== sbe.dataset.scroll) &&
        isVerseKey
      ) {
        sbe.dataset.scroll = scrollkey;
        let s = scroll(sbe, newScroll);
        console.log(`scroll(sbe, ${JSON.stringify(newScroll)})`);
        // pageChange('prev') requires another setState to update bk.ch.vs
        if (s && versification) {
          let { book: bk, chapter: ch, verse: vs } = s as any;
          [bk, ch, vs] = G.LibSword.convertLocation(
            G.Tab[newScroll.module].v11n,
            [bk, ch, vs, vs].join('.'),
            versification
          ).split('.');
          s = {
            book: bk,
            chapter: Number(ch),
            verse: Number(vs),
          };
          if (isPinned) {
            newState = {
              ...newState,
              pin: { ...newPin, ...s, flagScroll: C.SCROLLTYPENONE },
            };
          } else {
            G.Prefs.setCharPref('xulsword.book', bk);
            G.Prefs.setIntPref('xulsword.chapter', Number(ch));
            G.Prefs.setIntPref('xulsword.verse', Number(vs));
            G.Prefs.setComplexValue('xulsword.flagScroll', [
              C.SCROLLTYPENONE,
              C.SCROLLTYPENONE,
              C.SCROLLTYPENONE,
            ]);
            setTimeout(() => {
              G.setGlobalStateFromPrefs([
                'xulsword.book',
                'xulsword.chapter',
                'xulsword.verse',
                'xulsword.flagScroll',
              ]);
            }, 1);
          }
        }
      }
      // Highlight if needed
      if (type === C.BIBLE && pin && selection !== pin.selection) {
        highlight(sbe, selection, module, versification);
        console.log(
          `highlight(sbe, ${selection}, ${module}, ${versification})`
        );
      }
      // Trim multi-column Bible notes
      if (columns > 1) {
        const empty = !trimNotes(sbe, nbe, module);
        const nbc = nbe.parentNode as any;
        if (empty && !nbc.classList.contains('noteboxEmpty')) {
          nbc.classList.add('noteboxEmpty');
        } else if (!empty && nbc.classList.contains('noteboxEmpty')) {
          nbc.classList.remove('noteboxEmpty');
        }
      }
      if (type === C.BIBLE) {
        // window.setTimeout(function () {BibleTexts.updateAudioLinks(w);}, 0);
      }
    }
    if (Object.keys(newState).length) this.setState(newState);
  }

  // Write a LibSword response to the DOM.
  writeLibSword2DOM(
    libsword: AtextProps,
    n: number,
    flag: 'overwrite' | 'prepend' | 'append'
  ) {
    const { sbref, nbref } = this;
    const sbe = sbref !== null ? sbref.current : null;
    const nbe = nbref !== null ? nbref.current : null;
    if (sbe && nbe) {
      let chfirst;
      let chlast;
      let originalch;
      if ('chapter' in libsword) {
        originalch = libsword.chapter;
        chfirst =
          'chfirst' in sbe.dataset
            ? Number(sbe.dataset.chfirst)
            : libsword.chapter;
        chlast =
          'chlast' in sbe.dataset
            ? Number(sbe.dataset.chlast)
            : libsword.chapter;
      }
      if (chfirst && flag === 'prepend') {
        chfirst -= 1;
        libsword.chapter = chfirst;
      }
      if (chlast && flag === 'append') {
        chlast += 1;
        libsword.chapter = chlast;
      }
      const response = Atext.libswordResponseMemoized(libsword, n);
      let fntable = nbe.firstChild as HTMLElement | null;
      switch (flag) {
        case 'overwrite':
          sanitizeHTML(sbe, response.textHTML);
          sanitizeHTML(nbe, `<div class="fntable">${response.noteHTML}</div>`);
          this.notes = response.notes;
          this.intronotes = response.intronotes;
          console.log(
            `writeLibSword2DOM(${libsword.chapter}, ${n}, 'overwrite')`
          );
          break;
        case 'prepend': {
          if (fntable) {
            sanitizeHTML(sbe, response.textHTML + sbe.innerHTML);
            sanitizeHTML(
              nbe,
              `<div class="fntable">${
                response.noteHTML + fntable.innerHTML
              }</div>`
            );
            this.notes = response.notes + this.notes;
            this.intronotes = response.intronotes + this.intronotes;
            console.log(
              `writeLibSword2DOM(${libsword.chapter}, ${n}, 'prepend')`
            );
          }
          break;
        }
        case 'append': {
          if (fntable) {
            sanitizeHTML(sbe, sbe.innerHTML + response.textHTML);
            sanitizeHTML(
              nbe,
              `<div class="fntable">${
                fntable.innerHTML + response.noteHTML
              }</div>`
            );
            this.notes += response.notes;
            this.intronotes += response.intronotes;
            console.log(
              `writeLibSword2DOM(${libsword.chapter}, ${n}, 'append')`
            );
          }
          break;
        }
        default:
          throw Error('writeLibSword unrecognized flag');
      }
      fntable = nbe.firstChild as HTMLElement | null;
      sbe.dataset.libsword = stringHash({ ...libsword, chapter: 0 }, n);
      sbe.dataset.scroll = undefined;
      if ('chapter' in libsword) {
        if (flag === 'overwrite') {
          sbe.dataset.chfirst = libsword.chapter.toString();
          sbe.dataset.chlast = libsword.chapter.toString();
        } else {
          sbe.dataset.chfirst = chfirst ? chfirst.toString() : '999';
          sbe.dataset.chlast = chlast ? chlast.toString() : '0';
        }
        if (originalch !== undefined) libsword.chapter = originalch;
      }
      const nbc = nbe.parentNode as any;
      if (!fntable?.innerHTML && !nbc.classList.contains('noteboxEmpty'))
        nbc.classList.add('noteboxEmpty');
      if (fntable?.innerHTML && nbc.classList.contains('noteboxEmpty'))
        nbc.classList.remove('noteboxEmpty');
    }
  }

  // stop notebox resizing and call xulswordHandler
  bbMouseUp(this: Atext, e: any, nbr?: number[], maximize?: boolean) {
    const { noteBoxResizing } = this.state as AtextState;
    const props = this.props as AtextProps;
    if (noteBoxResizing === null) return;
    e.stopPropagation();
    const newnbr = nbr || noteBoxResizing;
    this.setState({ noteBoxResizing: null });
    e.type = 'mouseup';
    props.xulswordHandler(e, newnbr, maximize);
  }

  render() {
    const state = this.state as AtextState;
    const props = this.props as AtextProps;
    const { handler, bbMouseUp } = this;
    const { noteBoxResizing, pin, versePerLine } = state;
    const { columns, isPinned, maximizeNoteBox, module, n, noteBoxHeight } =
      props;

    // Check isPinned and collect the props/state combination to render.
    const newPin = Atext.copyProps(pin && isPinned ? pin : props, C.PinProps);

    // Header logic etc.
    const textIsVerseKey = module && G.Tab[module].isVerseKey;
    const appIsRTL = G.ProgramConfig?.direction === 'rtl';
    const prevArrow = appIsRTL
      ? String.fromCharCode(8594)
      : String.fromCharCode(8592);
    const nextArrow = appIsRTL
      ? String.fromCharCode(8592)
      : String.fromCharCode(8594);
    const disablePrev = textIsVerseKey && newPin?.chapter < 2;
    const disableNext = false;

    // Notebox logic etc.
    const doMaximizeNB =
      noteBoxResizing === null && columns !== 1 && maximizeNoteBox > 0;
    let bbtop;
    if (noteBoxResizing !== null) {
      const [initial, current] = noteBoxResizing;
      bbtop = { top: `${current - initial}px` };
    }

    // Class list
    let cls = `text text${n} show${columns} userFontSize`;
    if (module) cls += ` ${G.Tab[module].tabType}`;
    if (module && G.Tab[module].isRTL) cls += ' rtl-text';
    if (appIsRTL) cls += ' chromedir-rtl';
    if (isPinned) cls += ' pinned';
    if (doMaximizeNB) cls += ' noteboxMaximized';
    if (versePerLine) cls += ' verse-per-line';

    return (
      <Vbox
        {...props}
        {...xulClass(`atext ${cls}`, props)}
        {...handle('onDoubleClick', handler, props)}
        {...handle('onClick', handler, props)}
        {...handle('onWheel', handler, props)}
        {...handle('onMouseOver', handler, props)}
        {...handle('onMouseOut', handler, props)}
        {...handle('onMouseDown', handler, props)}
        {...handle('onMouseMove', handler, props)}
        {...handle('onMouseUp', bbMouseUp, props)}
        {...handle('onMouseLeave', handler, props)}
        style={{ ...props.style, position: 'relative' }}
        data-wnum={n}
        data-module={module}
        data-columns={columns}
      >
        <div
          className="sbcontrols"
          style={{ position: 'absolute', top: '0px' }}
        >
          <div className="text-pin" />
          <div className="text-win" />
        </div>

        <Box className="hd" height={`${C.TextHeaderHeight}px`}>
          <div className="navlink">
            <span className="navlink-span">{prevArrow}</span>
            <a className={`prevchaplink ${disablePrev ? 'disabled' : ''}`}>
              {i18next.t('PrevChaptext')}
            </a>{' '}
            <a className={`nextchaplink ${disableNext ? 'disabled' : ''}`}>
              {i18next.t('NextChaptext')}
            </a>{' '}
            <span className="navlink-span">{nextArrow}</span>
          </div>
        </Box>

        <Vbox
          className={`sb cs-${module}`}
          domref={this.sbref}
          pack="start"
          flex="1"
        />

        <Vbox className="nbc" height={`${noteBoxHeight}px`}>
          <Hbox>
            <div className={`bb ${bbtop ? 'moving' : ''}`} style={bbtop} />
            <div className="notebox-maximizer" />
          </Hbox>
          <Box className="nb" domref={this.nbref} flex="1" />
        </Vbox>
      </Vbox>
    );
  }
}
Atext.defaultProps = defaultProps;
Atext.propTypes = propTypes;
Atext.cacheReset();
Atext.libswordResponseMemoized = memoize(Atext.libswordResponse, {
  max: 20, // remember up to 20 LibSword responses
  normalizer: (...args: any) =>
    args.map((arg: any) => stringHash(arg)).join('+'),
});
window.ipc.renderer.on('reset', () => {
  const m = Atext.libswordResponseMemoized as any;
  m.clear();
  Atext.cacheReset();
});

export default Atext;

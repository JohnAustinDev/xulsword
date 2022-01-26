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
import C from '../../constant';
import {
  compareObjects,
  ofClass,
  sanitizeHTML,
  stringHash,
} from '../../common';
import G from '../rg';
import { libswordImgSrc, scrollIntoView } from '../rutil';
import {
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  addClass,
  topHandle,
} from '../libxul/xul';
import { Vbox, Hbox, Box } from '../libxul/boxes';
import { libswordText } from './ztext';
import {
  highlight,
  scroll,
  trimNotes,
  findVerseElement,
  textChange,
} from './zversekey';
import handlerH from './atextH';
import '../libxul/xul.css';
import '../libsword.css';
import './atext.css';

import type { MouseWheel } from './viewportParentH';
import type { PlaceType, ShowType } from '../../type';

const defaultProps = {
  ...xulDefaultProps,
  ownWindow: false,
};

const propTypes = {
  ...xulPropTypes,
  onMaximizeNoteBox: PropTypes.func.isRequired,
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
  windowV11n: PropTypes.string,
};

// Atext's properties. NOTE: property types are used, but property values are not.
const atextProps = {
  onMaximizeNoteBox: (
    _e: React.SyntheticEvent<any>,
    _noteboxResizing?: number[],
    _maximize?: boolean
  ): void => {},
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
  windowV11n: '' as string | undefined, // v11n of the viewport (not necessarily of the text)
};

export type AtextProps = XulProps & typeof atextProps;

export type LibSwordResponse = {
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

const memoize = require('memoizee');

const libswordResponseMemoized = memoize(libswordText, {
  max: 100, // remember up to 100 LibSword responses
  normalizer: (...args: any) =>
    args.map((arg: any) => stringHash(arg)).join('+'),
});
window.ipc.renderer.on('perform-resets', () => {
  libswordResponseMemoized.clear();
});

// XUL Atext
class Atext extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  static copyProps(source: any, which: any) {
    const p: any = {};
    Object.keys(which).forEach((k) => {
      p[k] = k in source ? source[k] : undefined;
    });
    return p;
  }

  handler: (e: React.SyntheticEvent) => void;

  mouseWheel: MouseWheel;

  sbref: React.RefObject<HTMLDivElement>;

  nbref: React.RefObject<HTMLDivElement>;

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

    this.onUpdate = this.onUpdate.bind(this);
    this.writeLibSword2DOM = this.writeLibSword2DOM.bind(this);
    this.handler = handlerH.bind(this);
    this.bbMouseUp = this.bbMouseUp.bind(this);
  }

  componentDidMount() {
    this.onUpdate();
  }

  componentDidUpdate() {
    this.onUpdate();
  }

  // The render() function of the Atext component does not render the
  // actual text content from LibSword. This onUpdate function uses
  // LibSword to write text to the already rendered component's sb
  // (scripture box) and nb (not box) divs. It first checks if sb
  // already contains the necessary LibSword response and if not,
  // memoizes the required response and updates sb and nb contents.
  // It then does any srolling, highlighting, footnote adjustments
  // etc. that must wait until Atext contains the LibSword response.
  // NOTE: the related hashes must be stored on the HTML element
  // itself, because DOM elements may be silently replaced by React
  // and storing it there insures the hashes are invalidated at the
  // same time. Finally, the pin state is updated if it has changed.
  onUpdate() {
    const props = this.props as AtextProps;
    const state = this.state as AtextState;
    const { columns, isPinned, n, windowV11n } = props;
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
      // SCROLL
      if (
        newScroll.flagScroll !== C.SCROLLTYPENONE &&
        (update || scrollkey !== sbe.dataset.scroll) &&
        isVerseKey
      ) {
        sbe.dataset.scroll = scrollkey;
        let s = scroll(sbe, newScroll);
        console.log(`scroll(sbe, ${JSON.stringify(newScroll)})`);
        // pageChange('prev') requires another setState to update bk.ch.vs
        if (s && windowV11n) {
          let { book: bk, chapter: ch, verse: vs } = s as any;
          [bk, ch, vs] = G.LibSword.convertLocation(
            G.Tab[newScroll.module].v11n,
            [bk, ch, vs, vs].join('.'),
            windowV11n
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
      } else if (update && type === C.DICTIONARY) {
        const { modkey } = newLibSword;
        const id = `${stringHash(modkey)}.${n}`;
        const keyelem = document.getElementById(id);
        if (keyelem) {
          scrollIntoView(keyelem, nbe);
          const dictlist = keyelem.parentNode?.parentNode as HTMLElement | null;
          if (dictlist) {
            const dki = dictlist.getElementsByClassName(
              'dictkeyinput'
            ) as unknown as HTMLInputElement[] | null;
            if (dki) {
              dki[0].focus();
              dki[0].select();
            }
          }
        }
      }
      // HIGHLIGHT
      if (type === C.BIBLE && pin && selection !== pin.selection) {
        highlight(sbe, selection, module, windowV11n);
        console.log(`highlight(sbe, ${selection}, ${module}, ${windowV11n})`);
      }
      if (columns > 1) {
        const empty = !trimNotes(sbe, nbe);
        const nbc = nbe.parentNode as any;
        if (
          (empty && !nbc.classList.contains('noteboxEmpty')) ||
          (!empty && nbc.classList.contains('noteboxEmpty'))
        ) {
          nbc.classList.toggle('noteboxEmpty');
        }
      }
      // AUDIO LINKS
      if (type === C.BIBLE) {
        // window.setTimeout(function () {BibleTexts.updateAudioLinks(w);}, 0);
      }
      // PREV / NEXT LINKS
      setTimeout(() => {
        const atextc = ofClass(['atext'], sbe);
        if (atextc) {
          const atext = atextc.element;
          const prev = textChange(atext, false);
          const next = textChange(atext, true);
          const prevdis = atext.classList.contains('prev-disabled');
          const nextdis = atext.classList.contains('next-disabled');
          if ((!prev && !prevdis) || (prev && prevdis)) {
            atext.classList.toggle('prev-disabled');
          }
          if ((!next && !nextdis) || (next && nextdis)) {
            atext.classList.toggle('next-disabled');
          }
        }
      }, 1);
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
      const isDict =
        libsword.module && G.Tab[libsword.module].type === C.DICTIONARY;
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
      const response = libswordResponseMemoized(libsword, n);
      let fntable = (!isDict ? nbe.firstChild : null) as HTMLElement | null;
      let sb;
      let nb;
      switch (flag) {
        case 'overwrite':
          sb = response.textHTML;
          nb = response.noteHTML;
          console.log(
            `writeLibSword2DOM(${libsword.chapter}, ${n}, 'overwrite')`
          );
          break;
        case 'prepend': {
          if (fntable) {
            sb = response.textHTML + sbe.innerHTML;
            nb = response.noteHTML + fntable.innerHTML;
            console.log(
              `writeLibSword2DOM(${libsword.chapter}, ${n}, 'prepend')`
            );
          }
          break;
        }
        case 'append': {
          if (fntable) {
            sb = sbe.innerHTML + response.textHTML;
            nb = fntable.innerHTML + response.noteHTML;
            console.log(
              `writeLibSword2DOM(${libsword.chapter}, ${n}, 'append')`
            );
          }
          break;
        }
        default:
          throw Error('writeLibSword unrecognized flag');
      }
      if (nb !== undefined && !isDict) {
        nb = `<div class="fntable">${nb}</div>`;
      }
      if (sb !== undefined) {
        sanitizeHTML(sbe, sb);
        libswordImgSrc(sbe);
      }
      if (nb !== undefined) {
        sanitizeHTML(nbe, nb);
        libswordImgSrc(nbe);
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
      if (
        (!fntable?.innerHTML && !nbc.classList.contains('noteboxEmpty')) ||
        (fntable?.innerHTML && nbc.classList.contains('noteboxEmpty'))
      )
        nbc.classList.toggle('noteboxEmpty');
    }
  }

  // This is also called by onMouseMove when bb moves beyond min/max.
  bbMouseUp(this: Atext, e: any, nbr?: number[], maximize?: boolean) {
    const { noteBoxResizing } = this.state as AtextState;
    const props = this.props as AtextProps;
    if (noteBoxResizing === null) return;
    e.stopPropagation();
    const newnbr = nbr || noteBoxResizing;
    this.setState({ noteBoxResizing: null });
    e.type = 'mouseup';
    props.onMaximizeNoteBox(e, newnbr, maximize);
  }

  render() {
    const state = this.state as AtextState;
    const props = this.props as AtextProps;
    const { handler, bbMouseUp } = this;
    const { noteBoxResizing, versePerLine } = state;
    const { columns, isPinned, maximizeNoteBox, module, n, noteBoxHeight } =
      props;

    // Header logic etc.
    const appIsRTL = G.ProgramConfig?.direction === 'rtl';
    const prevArrow = appIsRTL
      ? String.fromCharCode(8594)
      : String.fromCharCode(8592);
    const nextArrow = appIsRTL
      ? String.fromCharCode(8592)
      : String.fromCharCode(8594);

    // Notebox height
    const doMaximizeNB =
      noteBoxResizing === null && columns !== 1 && maximizeNoteBox > 0;
    let bbtop;
    if (noteBoxResizing !== null) {
      const [initial, current] = noteBoxResizing;
      bbtop = { top: `${current - initial}px` };
    }

    // Class list
    let cls = `text text${n} show${columns} userFontSize`;
    cls += ' prev-disabled next-disabled';
    if (module) cls += ` ${G.Tab[module].tabType}`;
    if (module && G.Tab[module].isRTL) cls += ' rtl-text';
    if (appIsRTL) cls += ' chromedir-rtl';
    if (isPinned) cls += ' pinned';
    if (doMaximizeNB) cls += ' noteboxMaximized';
    if (versePerLine) cls += ' verse-per-line';

    return (
      <Vbox
        {...addClass(`atext ${cls}`, props)}
        {...topHandle('onDoubleClick', handler, props)}
        {...topHandle('onClick', handler, props)}
        {...topHandle('onWheel', handler, props)}
        {...topHandle('onMouseOver', handler, props)}
        {...topHandle('onMouseLeave', handler, props)}
        {...topHandle('onMouseOut', handler, props)}
        {...topHandle('onMouseDown', handler, props)}
        {...topHandle('onMouseMove', handler, props)}
        {...topHandle('onMouseUp', bbMouseUp, props)}
        data-wnum={n}
        data-module={module}
        data-columns={columns}
      >
        <div className="sbcontrols">
          <div className="text-pin" />
          <div className="text-win" />
        </div>

        <Box className="hd" height={`${C.TextHeaderHeight}px`}>
          <div className="navlink">
            <span className="navlink-span">{prevArrow}</span>
            <a className="prevchaplink">{i18next.t('PrevChaptext')}</a>{' '}
            <a className="nextchaplink">{i18next.t('NextChaptext')}</a>{' '}
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

export default Atext;

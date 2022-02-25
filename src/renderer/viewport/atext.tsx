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
import {
  clearPending,
  verseKey,
  getMaxChapter,
  libswordImgSrc,
  scrollIntoView,
  setStatePref,
} from '../rutil';
import {
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  addClass,
  topHandle,
} from '../libxul/xul';
import { Vbox, Hbox, Box } from '../libxul/boxes';
import { libswordText, textChange } from './ztext';
import {
  highlight,
  versekeyScroll,
  trimNotes,
  findVerseElement,
} from './zversekey';
import handlerH from './atextH';
import '../libxul/xul.css';
import '../libsword.css';
import './atext.css';

import type { MouseWheel } from './viewportParentH';
import type { LocationVKType, PlaceType, ShowType } from '../../type';

const defaultProps = {
  ...xulDefaultProps,
  ownWindow: false,
};

const propTypes = {
  ...xulPropTypes,
  onMaximizeNoteBox: PropTypes.func.isRequired,
  panelIndex: PropTypes.number.isRequired,
  columns: PropTypes.number.isRequired,
  location: PropTypes.object,
  module: PropTypes.string,
  ilModule: PropTypes.string,
  ilModuleOption: PropTypes.arrayOf(PropTypes.string).isRequired,
  modkey: PropTypes.string,
  selection: PropTypes.object,
  flagScroll: PropTypes.number,
  isPinned: PropTypes.bool.isRequired,
  noteBoxHeight: PropTypes.number,
  maximizeNoteBox: PropTypes.number,
  show: PropTypes.object.isRequired,
  place: PropTypes.object.isRequired,
  ownWindow: PropTypes.bool,
};

// Atext's properties. NOTE: property types are used, but property values are not.
const atextProps = {
  onMaximizeNoteBox: (
    _e: React.SyntheticEvent<any>,
    _noteboxResizing?: number[],
    _maximize?: boolean
  ): void => {},
  panelIndex: 0 as number,
  columns: 0 as number,
  location: null as LocationVKType | null,
  module: '' as string | undefined,
  ilModule: '' as string | undefined,
  ilModuleOption: [] as string[],
  modkey: '' as string,
  selection: null as LocationVKType | null,
  flagScroll: 0 as number | undefined,
  isPinned: false as boolean,
  noteBoxHeight: 0 as number,
  maximizeNoteBox: 0 as number,
  show: {} as ShowType,
  place: {} as PlaceType,
  ownWindow: false as boolean,
} as const;

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
window.ipc.renderer.on('module-reset', () => {
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

  wheelScrollTO: NodeJS.Timeout | undefined;

  mouseWheel: MouseWheel;

  sbref: React.RefObject<HTMLDivElement>;

  nbref: React.RefObject<HTMLDivElement>;

  constructor(props: AtextProps) {
    super(props);

    const s: AtextState = {
      pin: null,
      versePerLine: false,
      noteBoxResizing: null,
    };
    this.state = s;

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

  componentWillUnmount() {
    clearPending(this, 'wheelScrollTO');
  }

  // The render() function of the Atext component does not render the
  // actual text content from LibSword. This onUpdate function uses
  // LibSword to write text to the already rendered component's sb
  // (scripture box) and nb (not box) divs. It first checks if sb
  // already contains the necessary LibSword response and if not,
  // memoizes the required response and updates sb and nb contents.
  // It then does any srolling, highlighting, footnote adjustments
  // etc. which must wait until Atext contains the LibSword response.
  // Finally, the pin state is updated if it has changed.  NOTE: the
  // related hashes must be stored on the HTML element itself, because
  // DOM elements may be silently replaced by React and storing it
  // there insures the hashes are invalidated at the same time.
  onUpdate() {
    const props = this.props as AtextProps;
    const state = this.state as AtextState;
    const { columns, isPinned, panelIndex } = props;
    const { pin } = state as AtextState;
    const { sbref, nbref } = this;

    const sbe = sbref !== null ? sbref.current : null;
    const nbe = nbref !== null ? nbref.current : null;

    let newState: Partial<AtextState> = {};
    const newPin = Atext.copyProps(
      pin && isPinned ? pin : props,
      C.PinProps
    ) as typeof C.PinProps;
    const { selection, module } = newPin;
    if (!compareObjects(newPin, pin)) newState = { ...newState, pin: newPin };
    if (module && sbe && nbe) {
      const { type, isVerseKey } = G.Tab[module];
      const newLibSword = Atext.copyProps(
        {
          ...props,
          ...newPin,
        },
        C.LibSwordProps[type]
      ) as Partial<AtextProps>;
      const newScroll = Atext.copyProps(
        { ...props, ...newPin },
        C.ScrollProps[type]
      ) as Partial<AtextProps>;
      const writekey = stringHash({ ...newLibSword, chapter: 0 }, panelIndex);
      const scrollkey = stringHash(newScroll);
      let update = false; // update current innerHTML as needed
      if (!isVerseKey) {
        update = writekey !== sbe.dataset.libsword;
        if (update)
          this.writeLibSword2DOM(newLibSword, panelIndex, 'overwrite');
      } else if (newLibSword.location) {
        let chfirst;
        let chlast;
        if ('chfirst' in sbe.dataset) chfirst = Number(sbe.dataset.chfirst);
        if ('chlast' in sbe.dataset) chlast = Number(sbe.dataset.chlast);
        update =
          writekey !== sbe.dataset.libsword ||
          !(
            chfirst &&
            chlast &&
            newLibSword.location.chapter >= chfirst &&
            newLibSword.location.chapter <= chlast
          ) ||
          chlast - chfirst > 10;
        if (update) {
          this.writeLibSword2DOM(newLibSword, panelIndex, 'overwrite');
          chfirst = Number(sbe.dataset.chfirst);
          chlast = Number(sbe.dataset.chlast);
        }
        // Prepare for Bible column scrolling if needed
        if (
          chfirst &&
          chlast &&
          columns > 1 &&
          type === C.BIBLE &&
          newScroll.flagScroll !== C.VSCROLL.none &&
          (update || scrollkey !== sbe.dataset.scroll)
        ) {
          const rtl = G.ModuleConfigs[module].direction === 'rtl';
          let v = findVerseElement(
            sbe,
            newLibSword.location.chapter,
            newLibSword.location.verse || 1
          );
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
            this.writeLibSword2DOM(newLibSword, panelIndex, 'prepend');
            v = findVerseElement(
              sbe,
              newLibSword.location.chapter,
              newLibSword.location.verse || 1
            );
            chfirst -= 1;
          }
          const max = getMaxChapter(
            G.Tab[module].v11n || 'KJV',
            newLibSword.location.book
          );
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
            this.writeLibSword2DOM(newLibSword, panelIndex, 'append');
            v = findVerseElement(
              sbe,
              newLibSword.location.chapter,
              newLibSword.location.verse || 1
            );
            last = sbe.lastChild as HTMLElement | null;
            chlast += 1;
          }
        }
      }
      // SCROLL
      if (
        newScroll.flagScroll !== C.VSCROLL.none &&
        (update || scrollkey !== sbe.dataset.scroll) &&
        isVerseKey
      ) {
        sbe.dataset.scroll = scrollkey;
        const location = versekeyScroll(
          sbe,
          newScroll as typeof C.ScrollPropsVK
        );
        if (location) {
          const loc = verseKey(location).location(newLibSword.location?.v11n);
          if (isPinned) {
            newState = {
              ...newState,
              pin: {
                ...newPin,
                location: loc,
                flagScroll: C.VSCROLL.none,
              },
            };
          } else {
            const fs = [];
            fs[panelIndex] = C.VSCROLL.none;
            setStatePref('xulsword', { location: loc, flagScroll: fs });
          }
        }
      } else if (update && type === C.DICTIONARY) {
        const { modkey } = newLibSword;
        const id = `${stringHash(modkey)}.${panelIndex}`;
        const keyelem = document.getElementById(id);
        if (keyelem) {
          scrollIntoView(keyelem, nbe, 40);
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
      if (selection && !isPinned && type === C.BIBLE) {
        highlight(sbe, selection, module);
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
    libsword: Partial<AtextProps>,
    i: number,
    flag: 'overwrite' | 'prepend' | 'append'
  ) {
    const { sbref, nbref } = this;
    const sbe = sbref !== null ? sbref.current : null;
    const nbe = nbref !== null ? nbref.current : null;
    if (sbe && nbe) {
      const { location } = libsword;
      const isDict =
        libsword.module && G.Tab[libsword.module].type === C.DICTIONARY;
      let chfirst;
      let chlast;
      let originalch;
      if (location) {
        originalch = location.chapter;
        chfirst =
          'chfirst' in sbe.dataset
            ? Number(sbe.dataset.chfirst)
            : location.chapter;
        chlast =
          'chlast' in sbe.dataset
            ? Number(sbe.dataset.chlast)
            : location.chapter;
        if (chfirst && flag === 'prepend') {
          chfirst -= 1;
          location.chapter = chfirst;
        }
        if (chlast && flag === 'append') {
          chlast += 1;
          location.chapter = chlast;
        }
      }
      const response = libswordResponseMemoized(libsword, i);
      let fntable = (!isDict ? nbe.firstChild : null) as HTMLElement | null;
      let sb;
      let nb;
      switch (flag) {
        case 'overwrite':
          sb = response.textHTML;
          nb = response.noteHTML;
          break;
        case 'prepend': {
          if (fntable) {
            sb = response.textHTML + sbe.innerHTML;
            nb = response.noteHTML + fntable.innerHTML;
          }
          break;
        }
        case 'append': {
          if (fntable) {
            sb = sbe.innerHTML + response.textHTML;
            nb = fntable.innerHTML + response.noteHTML;
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
      sbe.dataset.libsword = stringHash({ ...libsword, chapter: 0 }, i);
      sbe.dataset.scroll = undefined;
      if (location) {
        if (flag === 'overwrite') {
          sbe.dataset.chfirst = location.chapter.toString();
          sbe.dataset.chlast = location.chapter.toString();
        } else {
          sbe.dataset.chfirst = chfirst ? chfirst.toString() : '999';
          sbe.dataset.chlast = chlast ? chlast.toString() : '0';
        }
        if (originalch !== undefined) location.chapter = originalch;
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
    const {
      columns,
      isPinned,
      maximizeNoteBox,
      module,
      panelIndex,
      noteBoxHeight,
      ownWindow,
    } = props;

    // Header logic etc.
    const appIsRTL = G.ProgramConfig?.direction === 'rtl';
    const prevArrow = appIsRTL
      ? String.fromCharCode(8594)
      : String.fromCharCode(8592);
    const nextArrow = appIsRTL
      ? String.fromCharCode(8592)
      : String.fromCharCode(8594);
    const isVerseKey = module && G.Tab[module].isVerseKey;

    // Notebox height
    const doMaximizeNB =
      noteBoxResizing === null && columns !== 1 && maximizeNoteBox > 0;
    let bbtop;
    if (noteBoxResizing !== null) {
      const [initial, current] = noteBoxResizing;
      bbtop = { top: `${current - initial}px` };
    }

    // Class list
    let cls = `text text${panelIndex} columns${columns} userFontSize`;
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
        data-index={panelIndex}
        data-module={module}
        data-columns={columns}
        data-ispinned={isPinned}
      >
        <div className="sbcontrols">
          {isVerseKey && <div className="text-pin" />}
          {!ownWindow && <div className="text-win" />}
        </div>

        <Box className="hd" height={`${C.UI.Atext.prevNextHeight}px`}>
          <div className="navlink">
            <span className="navlink-span">{prevArrow}</span>
            <a className="prevchaplink">{i18next.t('PrevChaptext')}</a>{' '}
            <a className="nextchaplink">{i18next.t('NextChaptext')}</a>{' '}
            <span className="navlink-span">{nextArrow}</span>
          </div>
        </Box>

        <Vbox
          className={`sb cs-${module}`}
          style={columns > 1 ? { columnCount: columns } : undefined}
          domref={this.sbref}
          pack="start"
          flex="1"
        />

        <Vbox
          className="nbc"
          height={`${noteBoxHeight}px`}
          style={
            columns > 1
              ? { width: `calc(${100 / columns}% - 10px)` }
              : undefined
          }
        >
          <Hbox>
            <div className={`bb ${bbtop ? 'moving' : ''}`} style={bbtop} />
            <div className="notebox-maximizer" />
          </Hbox>
          <div className="nb" ref={this.nbref} />
        </Vbox>
      </Vbox>
    );
  }
}
Atext.defaultProps = defaultProps;
Atext.propTypes = propTypes;

export default Atext;

/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable react/forbid-prop-types */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/jsx-props-no-spreading */
import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { getElementData, HTMLData, verseKey } from '../../htmlData';
import Cache from '../../../cache';
import C from '../../../constant';
import {
  diff,
  JSON_attrib_stringify,
  keep,
  sanitizeHTML,
  stringHash,
} from '../../../common';
import G from '../../rg';
import log from '../../log';
import {
  clearPending,
  getMaxChapter,
  libswordImgSrc,
  scrollIntoView,
  windowArguments,
  audioIcon,
} from '../../rutil';
import {
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  addClass,
  topHandle,
} from '../xul';
import DragSizer from '../dragsizer';
import { Vbox, Hbox, Box } from '../boxes';
import Spacer from '../spacer';
import { libswordText, textChange } from './ztext';
import {
  highlight,
  versekeyScroll,
  trimNotes,
  findVerseElement,
} from './zversekey';
import handlerH from './atextH';
import '../../libsword.css';
import './atext.css';

import type { AtextPropsType, PinPropsType } from '../../../type';

const defaultProps = {
  ...xulDefaultProps,
  ownWindow: false,
};

const propTypes = {
  ...xulPropTypes,
  bbDragEnd: PropTypes.func.isRequired,
  xulswordState: PropTypes.func.isRequired,
  panelIndex: PropTypes.number.isRequired,
  columns: PropTypes.number.isRequired,
  location: PropTypes.object,
  module: PropTypes.string,
  ilModule: PropTypes.string,
  ilModuleOption: PropTypes.arrayOf(PropTypes.string).isRequired,
  modkey: PropTypes.string,
  selection: PropTypes.object,
  scroll: PropTypes.object,
  isPinned: PropTypes.bool.isRequired,
  noteBoxHeight: PropTypes.number,
  maximizeNoteBox: PropTypes.bool,
  show: PropTypes.object.isRequired,
  place: PropTypes.object.isRequired,
  ownWindow: PropTypes.bool,
  onAudioClick: PropTypes.func.isRequired,
};

export type AtextProps = XulProps & AtextPropsType;

export const stateWinPrefs = {
  pin: null as PinPropsType | null,
  versePerLine: false as boolean,
  maxNoteBoxHeight: null as number | null,
};

const notStateWinPrefs = {
  origSelectDomNode: null as HTMLDivElement | null,
};

export type AtextStateType = typeof stateWinPrefs & typeof notStateWinPrefs;

// Window arguments that are used to set initial state must be updated locally
// and in Prefs, so that a component reset or program restart won't cause
// reversion to initial state.
const windowState: Partial<AtextStateType>[] = [];

// XUL Atext
class Atext extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  handler: typeof handlerH;

  wheelScrollTO: NodeJS.Timeout | undefined;

  sbref: React.RefObject<HTMLDivElement>;

  nbref: React.RefObject<HTMLDivElement>;

  constructor(props: AtextProps) {
    super(props);

    windowState[props.panelIndex] = windowArguments(
      `atext${props.panelIndex}State`
    ) as AtextStateType;

    const s: AtextStateType = {
      ...stateWinPrefs,
      ...notStateWinPrefs,
      ...windowState[props.panelIndex],
    };
    this.state = s;

    this.sbref = React.createRef();
    this.nbref = React.createRef();

    this.onUpdate = this.onUpdate.bind(this);
    this.writeLibSword2DOM = this.writeLibSword2DOM.bind(this);
    this.handler = handlerH.bind(this);
  }

  componentDidMount() {
    this.onUpdate();
  }

  componentDidUpdate(_prevProps: AtextProps, prevState: AtextStateType) {
    const { panelIndex } = this.props as AtextProps;
    const state = this.state as AtextStateType;
    if (this.onUpdate()) {
      windowState[panelIndex] = keep(
        state,
        Object.keys(stateWinPrefs) as (keyof typeof stateWinPrefs)[]
      );
      const changedState = diff(
        keep(
          prevState,
          Object.keys(stateWinPrefs) as (keyof typeof stateWinPrefs)[]
        ),
        windowState[panelIndex]
      );
      if (changedState) {
        G.Window.mergeValue(`atext${panelIndex}State`, changedState);
      }
    }
  }

  componentWillUnmount() {
    clearPending(this, 'wheelScrollTO');
  }

  // The render() function of the Atext component does not render the
  // actual text content from LibSword. This onUpdate function uses
  // LibSword to write text to the already rendered component's sb
  // (scripture box) and nb (note box) divs. It first checks if sb
  // already contains the necessary LibSword response and if not,
  // caches the required response and updates sb and nb contents.
  // It then does any srolling, highlighting, footnote adjustments
  // etc. which must wait until Atext contains the LibSword response.
  // Also, the pin state is updated if it has changed, and a few other
  // things. NOTE: the related hashes must be stored on the HTML element
  // itself, because DOM elements may be silently replaced by React and
  // storing it there insures the hashes are invalidated at the same time.
  onUpdate() {
    const props = this.props as AtextProps;
    const state = this.state as AtextStateType;
    const { columns, isPinned, panelIndex, xulswordState } = props;
    const { pin, maxNoteBoxHeight } = state as AtextStateType;
    let { origSelectDomNode } = state;

    // Decide what needs to be updated...
    // pinProps are the currently active props according to the panel's
    // isPinned prop value.
    const pinProps = keep(pin && isPinned ? pin : props, C.PinProps);
    // scrollProps are current props that effect scrolling
    const scrollProps = keep({ ...props, ...pinProps }, C.ScrollPropsVK);
    const { scroll } = scrollProps;
    // skip all render side-effects if skipTextUpdate is set
    if (scroll?.skipTextUpdate && scroll.skipTextUpdate[panelIndex])
      return false;

    let newState: Partial<AtextStateType> = diff(pin, pinProps)
      ? { pin: pinProps }
      : {};

    const { sbref, nbref } = this;
    const sbe = sbref !== null ? sbref.current : null;
    const nbe = nbref !== null ? nbref.current : null;

    // Adjust maxNoteBoxHeight height if needed
    const atext = sbe?.parentNode as HTMLElement | null | undefined;
    if (atext) {
      const hd = atext.firstChild as HTMLElement;
      let maxHeight = atext.offsetHeight - hd.offsetHeight;
      if (columns === 1) maxHeight -= C.UI.Atext.bbSingleColTopMargin;
      if (maxHeight !== maxNoteBoxHeight) newState.maxNoteBoxHeight = maxHeight;
    }

    const { selection, module } = pinProps;
    if (module && atext && sbe && nbe) {
      const { type, isVerseKey } = G.Tab[module];
      const scrollkey = stringHash(scrollProps);
      // libswordProps are current props that effect LibSword output
      const keepme: readonly (keyof AtextPropsType)[] = C.LibSwordProps[type];
      const libswordProps = keep(
        {
          ...props,
          ...pinProps,
        },
        keepme
      );
      const highlightkey = stringHash(libswordProps.location);
      // IMPORTANT: verse doesn't effect libsword output, so always remove
      // it from stringHash for a big speedup.
      const writekey = stringHash(
        {
          ...libswordProps,
          location: { ...libswordProps.location, verse: 0 },
        },
        panelIndex
      );
      const done =
        scrollProps.scroll?.verseAt === 'bottom' &&
        (columns === 1 || type !== C.BIBLE);
      if (libswordProps && !done) {
        const update = writekey !== sbe.dataset.libsword;
        if (update) {
          this.writeLibSword2DOM(libswordProps, panelIndex, 'overwrite');
          origSelectDomNode = null;
        }
        // SCROLL
        const doscroll =
          scrollProps.scroll &&
          (update || scrollkey !== sbe.dataset.scroll) &&
          isVerseKey;
        if (doscroll) {
          sbe.dataset.scroll = scrollkey;
          // Multi-column Bibles...
          if (columns > 1 && type === C.BIBLE && libswordProps.location) {
            const rtl = G.Config[module].direction === 'rtl';
            const verse = libswordProps.location.verse || 1;
            let v = findVerseElement(
              sbe,
              libswordProps.location.chapter,
              verse
            );
            if (v) {
              let sib: HTMLElement | null;
              if (scrollProps.scroll?.verseAt === 'bottom') {
                // MULTI-COLUMN SCROLL TO END, THEN UPDATE
                // Insure all verses are visible
                if (!update) {
                  sib = sbe.firstChild as HTMLElement | null;
                  while (sib) {
                    if ('style' in sib) sib.style.display = '';
                    sib = sib.nextSibling as HTMLElement | null;
                  }
                }
                // Prepend chapters until the selected verse is off the page.
                sib = sbe.firstChild as HTMLElement | null;
                while (
                  sib &&
                  !('classList' in sib && sib.classList.contains('vs'))
                ) {
                  sib = sib.nextSibling as HTMLElement | null;
                }
                let prepend = 0;
                if (sib) {
                  const i = getElementData(sib);
                  if (i.location) {
                    prepend = i.location.chapter - 1;
                  }
                }
                while (
                  v &&
                  prepend > 0 &&
                  ((!rtl && v.offsetLeft < sbe.offsetWidth) ||
                    (rtl && v.offsetLeft >= 0))
                ) {
                  const pre = {
                    ...libswordProps,
                    location: { ...libswordProps.location, chapter: prepend },
                  };
                  this.writeLibSword2DOM(pre, panelIndex, 'prepend');
                  origSelectDomNode = null;
                  v = findVerseElement(
                    sbe,
                    libswordProps.location.chapter,
                    verse
                  );
                  prepend -= 1;
                }
                // Hide starting verses until the selected verse is visible above the notebox.
                sib = sbe.firstChild as HTMLElement | null;
                const nbc = nbe.parentNode as HTMLElement;
                while (v && sib) {
                  const offpage =
                    (!rtl && v.offsetLeft > sbe.offsetWidth) ||
                    (rtl && v.offsetLeft <= 0);
                  const undernb =
                    v.offsetLeft > sbe.offsetWidth - 1.1 * nbe.offsetWidth &&
                    v.offsetTop > atext.offsetHeight - nbc.offsetHeight;
                  if (!offpage && !undernb) break;
                  let finished;
                  do {
                    if (sib && 'style' in sib) sib.style.display = 'none';
                    finished =
                      !sib ||
                      ('classList' in sib && sib.classList.contains('vs'));
                    sib = sib?.nextSibling as HTMLElement | null;
                  } while (!finished);
                }
                // Change state to first visible verse.
                if (!sib) sib = sbe.firstChild as HTMLElement | null;
                while (
                  sib &&
                  !(
                    'classList' in sib &&
                    sib.classList.contains('vs') &&
                    sib.style.display !== 'none'
                  )
                ) {
                  sib = sib.nextSibling as HTMLElement | null;
                }
                const info = (sib && getElementData(sib)) || null;
                if (info && info.location) {
                  const { book, chapter, verse: vs } = info.location;
                  const skipTextUpdate: boolean[] = [];
                  skipTextUpdate[panelIndex] = true;
                  const location = verseKey(
                    [book, chapter, vs].join('.'),
                    libswordProps.location.v11n
                  ).location();
                  if (isPinned) {
                    newState = {
                      ...newState,
                      pin: {
                        ...pinProps,
                        location,
                        scroll: {
                          verseAt: 'top',
                          skipTextUpdate,
                        },
                      },
                    };
                  } else {
                    xulswordState({
                      location,
                      scroll: {
                        verseAt: 'top',
                        skipTextUpdate,
                      },
                    });
                  }
                }
              } else {
                // MULTI-COLUMN SCROLL TO VERSE
                // verseAt determines which sibling is placed at the top.
                if (verse === 1 && scrollProps.scroll?.verseAt === 'top') {
                  v = sbe.firstChild as HTMLElement | null;
                } else if (scrollProps.scroll?.verseAt === 'center') {
                  let d = 4;
                  while (d && v) {
                    v = v.previousSibling as HTMLElement | null;
                    if (v && 'classList' in v && v.classList.contains('vs'))
                      d -= 1;
                  }
                  if (!v) v = sbe.firstChild as HTMLElement | null;
                }
                // Hide all siblings preceding the selected one, to make it
                // appear at the top.
                sib = sbe.firstChild as HTMLElement | null;
                let hide = true;
                let lastv;
                while (sib) {
                  if (sib === v) hide = false;
                  if ('style' in sib) sib.style.display = hide ? 'none' : '';
                  if ('classList' in sib && sib.classList.contains('vs'))
                    lastv = sib;
                  sib = sib.nextSibling as HTMLElement | null;
                }
                // Append chapters until text overflows
                let append = C.MAXCHAPTER + 1;
                if (lastv) {
                  const i = getElementData(lastv);
                  if (i && i.location) append = i.location.chapter + 1;
                }
                const v11n = G.Tab[module].v11n || null;
                const max = v11n
                  ? getMaxChapter(v11n, libswordProps.location.book)
                  : 0;
                while (append <= max && sbe.scrollWidth <= sbe.offsetWidth) {
                  const app = {
                    ...libswordProps,
                    location: { ...libswordProps.location, chapter: append },
                  };
                  this.writeLibSword2DOM(app, panelIndex, 'append');
                  origSelectDomNode = null;
                  append += 1;
                }
              }
            }
          } else {
            versekeyScroll(sbe, scrollProps);
          }
        } else if (update && type === C.GENBOOK && columns > 1 && sbe) {
          sbe.scrollLeft = 0;
        } else if (update && type === C.DICTIONARY) {
          const { modkey } = libswordProps;
          const id = `${stringHash(modkey)}.${panelIndex}`;
          const keyelem = document.getElementById(id);
          if (keyelem) {
            scrollIntoView(keyelem, nbe, 40);
            const dictlist = keyelem.parentNode
              ?.parentNode as HTMLElement | null;
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
        if (
          (update || highlightkey !== sbe.dataset.highlightkey) &&
          !isPinned &&
          selection &&
          type === C.BIBLE
        ) {
          highlight(sbe, selection, module);
          sbe.dataset.highlightkey = highlightkey;
        }
        // TRIM NOTES
        if (columns > 1 && (update || doscroll)) {
          const empty = !trimNotes(sbe, nbe);
          const nbc = nbe.parentNode as any;
          if ((empty || !nbc.innerText) && type !== 'Lexicons / Dictionaries') {
            nbc.classList.add('noteboxEmpty');
          } else nbc.classList.remove('noteboxEmpty');
        }
        // PREV / NEXT LINKS
        setTimeout(() => {
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
        }, 1);
      }
      // This adds the interlinear original language select element:
      const { ilModule, ilModuleOption } = props;
      if (
        ilModule &&
        ilModuleOption &&
        ilModuleOption.length > 1 &&
        !origSelectDomNode
      ) {
        origSelectDomNode = (sbe.getElementsByClassName('origselect')[0] ||
          null) as HTMLDivElement | null;
        if (origSelectDomNode) newState.origSelectDomNode = origSelectDomNode;
      }
    }
    if (Object.keys(newState).length) this.setState(newState);
    return true;
  }

  // Write a LibSword response to the DOM.
  writeLibSword2DOM(
    libswordProps: Pick<
      AtextPropsType,
      | 'module'
      | 'ilModule'
      | 'ilModuleOption'
      | 'location'
      | 'modkey'
      | 'place'
      | 'show'
    >,
    i: number,
    flag: 'overwrite' | 'prepend' | 'append'
  ) {
    const { sbref, nbref } = this;
    const sbe = sbref !== null ? sbref.current : null;
    const nbe = nbref !== null ? nbref.current : null;
    if (sbe && nbe) {
      const libswordHash = stringHash(
        {
          ...libswordProps,
          location: { ...libswordProps.location, verse: 0 },
        },
        i
      );
      if (!Cache.has(libswordHash)) {
        Cache.write(libswordText(libswordProps, i), libswordHash);
      }
      const response = Cache.read(libswordHash);
      log.silly(
        `${flag} panel ${i} ${verseKey(
          libswordProps.location || ''
        ).osisRef()}:`
      );
      const isDict =
        libswordProps.module &&
        G.Tab[libswordProps.module].type === C.DICTIONARY;
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
      if (flag === 'overwrite') {
        sbe.dataset.libsword = libswordHash;
        sbe.dataset.scroll = undefined;
      }
      const nbc = nbe.parentNode as any;
      fntable = nbe.firstChild as HTMLElement | null;
      if (!fntable?.innerText && !isDict) nbc.classList.add('noteboxEmpty');
      else nbc.classList.remove('noteboxEmpty');
    }
  }

  render() {
    const state = this.state as AtextStateType;
    const props = this.props as AtextProps;
    const { handler } = this;
    const { maxNoteBoxHeight, versePerLine, origSelectDomNode } = state;
    const {
      columns,
      isPinned,
      location,
      module,
      modkey,
      panelIndex,
      ownWindow,
      noteBoxHeight,
      maximizeNoteBox,
      ilModuleOption,
      ilModule,
      show,
      onAudioClick,
      bbDragEnd,
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
    const doMaximizeNB = columns !== 1 && maximizeNoteBox;
    let realNoteBoxHeight = noteBoxHeight;
    if (
      maxNoteBoxHeight &&
      (doMaximizeNB || realNoteBoxHeight > maxNoteBoxHeight)
    )
      realNoteBoxHeight = maxNoteBoxHeight;

    const moduleAlwaysVersePerLine =
      module && G.FeatureModules.NoParagraphs.includes(module);
    // Class list
    const classes = [
      'atext',
      'text',
      `text${panelIndex}`,
      `columns${columns}`,
      'prev-disabled',
      'next-disabled',
    ];
    if (module) classes.push(`${G.Tab[module].tabType}`);
    if (isPinned) classes.push('pinned');
    if (doMaximizeNB) classes.push('noteboxMaximized');
    if (versePerLine || moduleAlwaysVersePerLine) {
      if (!module || G.Tab[module].tabType === 'Texts') {
        classes.push('verse-per-line');
      } else classes.push('verse-per-line-com');
      if (moduleAlwaysVersePerLine) classes.push('always-vpl');
    }
    if (show.headings) classes.push('headings');

    const data: HTMLData = { type: 'text' };
    if (module && ['Dicts', 'Genbks'].includes(G.Tab[module].tabType)) {
      if (module && modkey) data.locationGB = { otherMod: module, key: modkey };
    } else if (location) data.location = location;

    return (
      <Vbox
        {...addClass(classes, props)}
        {...topHandle('onDoubleClick', handler, props)}
        {...topHandle('onClick', handler, props)}
        {...topHandle('onWheel', handler, props)}
        {...topHandle('onMouseOver', handler, props)}
        {...topHandle('onMouseOut', handler, props)}
        {...topHandle('onChange', handler, props)}
        data-index={panelIndex}
        data-module={module}
        data-columns={columns}
        data-ispinned={isPinned}
        data-data={JSON_attrib_stringify(data)}
      >
        <div className="sbcontrols">
          {isVerseKey && <div className="text-pin" />}
          {!ownWindow && <div className="text-win" />}
        </div>

        <Box className="hd">
          <div className="navlink">
            <span className="navlink-span">{prevArrow}</span>
            <a className="prevchaplink">{G.i18n.t('PrevChaptext')}</a>{' '}
            <a className="nextchaplink">{G.i18n.t('NextChaptext')}</a>{' '}
            <span className="navlink-span">{nextArrow}</span>
          </div>
        </Box>

        {module &&
          audioIcon(
            module,
            isVerseKey ? location?.book || '' : modkey,
            location?.chapter,
            onAudioClick
          )}

        {origSelectDomNode &&
          // This React portal injects a React select into rendered LibSword HTML.
          ReactDOM.createPortal(
            <select defaultValue={ilModule} onClick={handler}>
              {ilModuleOption.map((m) => {
                return (
                  <option
                    key={m}
                    className={`origoption ${G.Tab[m].labelClass}`}
                    value={m}
                  >
                    {G.Tab[m].label}
                  </option>
                );
              })}
            </select>,
            origSelectDomNode
          )}

        <Vbox
          className="sb"
          style={columns > 1 ? { columnCount: columns } : undefined}
          domref={this.sbref}
          pack="start"
          flex="1"
          dir={(module && G.Tab[module].direction) || 'auto'}
        />

        <Vbox
          className="nbc"
          height={realNoteBoxHeight}
          style={
            columns > 1
              ? { width: `calc(${100 / columns}% - 24px)` }
              : undefined
          }
        >
          <Hbox>
            <DragSizer
              onDragStart={() => realNoteBoxHeight}
              onDragEnd={bbDragEnd}
              min={C.UI.Atext.bbBottomMargin}
              max={maxNoteBoxHeight}
              shrink
            />
            <div className="notebox-maximizer" />
          </Hbox>
          <div className="nb" ref={this.nbref} />
          <Spacer orient="vertical" height="8px" />
        </Vbox>
      </Vbox>
    );
  }
}
Atext.defaultProps = defaultProps;
Atext.propTypes = propTypes;

export default Atext;
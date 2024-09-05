import React from 'react';
import PropTypes from 'prop-types';
import { getElementData, verseKey } from '../../htmlData.ts';
import Cache from '../../../cache.ts';
import C from '../../../constant.ts';
import {
  diff,
  JSON_attrib_stringify,
  keep,
  sanitizeHTML,
  stringHash,
} from '../../../common.ts';
import { G, GI } from '../../G.ts';
import log from '../../log.ts';
import {
  clearPending,
  getMaxChapter,
  libswordImgSrc,
  scrollIntoView,
} from '../../common.ts';
import RenderPromise from '../../renderPromise.ts';
import { xulPropTypes, addClass, topHandle } from '../libxul/xul.tsx';
import DragSizer from '../libxul/dragsizer.tsx';
import { Vbox, Hbox, Box } from '../libxul/boxes.tsx';
import Spacer from '../libxul/spacer.tsx';
import { libswordText, textChange } from './ztext.ts';
import {
  highlight,
  versekeyScroll,
  trimNotes,
  findVerseElement,
} from './zversekey.ts';
import handlerH from './atextH.ts';
import audioIcon from '../audioIcon/audioIcon.tsx';
import '../../libsword.css';
import './atext.css';

import type S from '../../../defaultPrefs.ts';
import type { AtextPropsType, PinPropsType } from '../../../type.ts';
import type {
  RenderPromiseComponent,
  RenderPromiseState,
} from '../../renderPromise.ts';
import type { HTMLData } from '../../htmlData.ts';
import type { XulProps } from '../libxul/xul.tsx';
import type { LibSwordResponse } from './ztext.ts';

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

const notStateWinPrefs = {};

export type AtextStateType = typeof stateWinPrefs &
  typeof notStateWinPrefs &
  RenderPromiseState;

// Window arguments that are used to set initial state must be updated locally
// and in Prefs, so that a component reset or program restart won't cause
// reversion to initial state.
const windowState: Array<Partial<AtextStateType>> = [];

// XUL Atext
class Atext extends React.Component implements RenderPromiseComponent {
  static propTypes: typeof propTypes;

  handler: typeof handlerH;

  wheelScrollTO: NodeJS.Timeout | undefined;

  sbref: React.RefObject<HTMLDivElement>;

  nbref: React.RefObject<HTMLDivElement>;

  renderPromise: RenderPromiseComponent['renderPromise'];

  constructor(props: AtextProps) {
    super(props);

    const s: AtextStateType = {
      ...stateWinPrefs,
      ...notStateWinPrefs,
      ...windowState[props.panelIndex],
      renderPromiseID: 0,
    };
    this.state = s;

    this.sbref = React.createRef();
    this.nbref = React.createRef();

    this.onUpdate = this.onUpdate.bind(this);
    this.writeLibSword2DOM = this.writeLibSword2DOM.bind(this);
    this.handler = handlerH.bind(this);

    this.renderPromise = new RenderPromise(this);
  }

  componentDidMount() {
    const { renderPromise } = this;
    this.onUpdate();
    renderPromise.dispatch();
  }

  componentDidUpdate(_prevProps: AtextProps, prevState: AtextStateType) {
    const { panelIndex } = this.props as AtextProps;
    const state = this.state as AtextStateType;
    const { renderPromise } = this;
    this.onUpdate();
    windowState[panelIndex] = keep(
      state,
      Object.keys(stateWinPrefs) as Array<keyof typeof stateWinPrefs>,
    );
    const changedState = diff(prevState, windowState[panelIndex]);
    if (Build.isElectronApp && changedState) {
      G.Window.mergeValue(`atext${panelIndex}State`, changedState);
    }
    renderPromise.dispatch();
  }

  componentWillUnmount() {
    clearPending(this, 'wheelScrollTO');
  }

  // The render() function of the Atext component does not render the
  // actual text content from LibSword. This onUpdate function uses
  // LibSword to write text to the already rendered component's sb
  // (scripture box) and nb (note box) divs. It first checks if sb
  // already contains the necessary LibSword response and if not,
  // requests it and caches the response and updates sb and nb contents.
  // It then does any scrolling, highlighting, footnote adjustments
  // etc. which must wait until Atext contains the LibSword response.
  // Also, the pin state is updated if it has changed, and a few other
  // things. NOTE: the related hashes must be stored on the HTML element
  // itself, because DOM elements may be silently replaced by React and
  // storing it there insures the hashes are invalidated at the same time.
  onUpdate() {
    const props = this.props as AtextProps;
    const state = this.state as AtextStateType;
    const { columns, isPinned, panelIndex, xulswordState } = props;
    const { pin, maxNoteBoxHeight } = state;
    const { renderPromise } = this;

    // Decide what needs to be updated...
    // pinProps are the currently active props according to the panel's
    // isPinned prop value.
    const pinProps = keep(pin && isPinned ? pin : props, C.PinProps);
    // scrollProps are current props that effect scrolling
    const scrollProps = keep({ ...props, ...pinProps }, C.ScrollPropsVK);

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
      const keepme: ReadonlyArray<keyof AtextPropsType> = C.LibSwordProps[type];
      const libswordProps = keep(
        {
          ...props,
          ...pinProps,
        },
        keepme,
      );
      const highlightkey = stringHash(libswordProps.location);
      // IMPORTANT: verse doesn't effect libsword output, so always remove
      // it from stringHash for a big speedup.
      const writekey = stringHash(
        {
          ...libswordProps,
          location: { ...libswordProps.location, verse: 0 },
        },
        panelIndex,
      );
      const skipUpdate =
        scrollProps.scroll?.verseAt === 'bottom' &&
        (columns === 1 || type !== C.BIBLE);
      if (libswordProps && !skipUpdate) {
        const update = writekey !== sbe.dataset.libsword;
        if (!renderPromise.waiting() && update) {
          this.writeLibSword2DOM(
            libswordProps,
            panelIndex,
            'overwrite',
            xulswordState,
            renderPromise,
          );
        }
        // SCROLL
        const doscroll =
          !renderPromise.waiting() &&
          scrollProps.scroll &&
          (update || scrollkey !== sbe.dataset.scroll) &&
          isVerseKey;
        if (doscroll) {
          // Multi-column Bibles...
          if (columns > 1 && type === C.BIBLE && libswordProps.location) {
            const rtl = G.Config[module].direction === 'rtl';
            const verse = libswordProps.location.verse || 1;
            let v = findVerseElement(
              sbe,
              libswordProps.location.chapter,
              verse,
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
                  !renderPromise.waiting() &&
                  v &&
                  prepend > 0 &&
                  ((!rtl && v.offsetLeft < sbe.offsetWidth) ||
                    (rtl && v.offsetLeft >= 0))
                ) {
                  const pre = {
                    ...libswordProps,
                    location: { ...libswordProps.location, chapter: prepend },
                  };
                  this.writeLibSword2DOM(
                    pre,
                    panelIndex,
                    'prepend',
                    xulswordState,
                    renderPromise,
                  );
                  v = findVerseElement(
                    sbe,
                    libswordProps.location.chapter,
                    verse,
                  );
                  prepend -= 1;
                }
                // Hide starting verses until the selected verse is visible above the notebox.
                sib = sbe.firstChild as HTMLElement | null;
                const nbc = nbe.parentNode as HTMLElement;
                while (!renderPromise.waiting() && v && sib) {
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
                if (!renderPromise.waiting()) {
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
                  if (info?.location) {
                    const { book, chapter, verse: vs } = info.location;
                    const location = verseKey(
                      [book, chapter, vs].join('.'),
                      libswordProps.location.v11n,
                      undefined,
                      renderPromise,
                    ).location();
                    if (isPinned) {
                      newState = {
                        ...newState,
                        pin: {
                          ...pinProps,
                          location,
                          scroll: { verseAt: 'top' },
                        },
                      };
                    } else {
                      xulswordState({
                        location,
                        scroll: { verseAt: 'top' },
                      });
                    }
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
                  if (i?.location) append = i.location.chapter + 1;
                }
                const v11n = G.Tab[module].v11n || null;
                const max = v11n
                  ? getMaxChapter(v11n, libswordProps.location.book)
                  : 0;
                while (
                  !renderPromise.waiting() &&
                  append <= max &&
                  sbe.scrollWidth <= sbe.offsetWidth
                ) {
                  const app = {
                    ...libswordProps,
                    location: { ...libswordProps.location, chapter: append },
                  };
                  this.writeLibSword2DOM(
                    app,
                    panelIndex,
                    'append',
                    xulswordState,
                    renderPromise,
                  );
                  append += 1;
                }
              }
            }
            if (!renderPromise.waiting()) sbe.dataset.scroll = scrollkey;
          } else {
            versekeyScroll(sbe, scrollProps);
            sbe.dataset.scroll = scrollkey;
          }
        } else if (update && type === C.GENBOOK && columns > 1 && sbe) {
          sbe.scrollLeft = 0;
          sbe.dataset.scroll = scrollkey;
        } else if (update && type === C.DICTIONARY) {
          const { modkey } = libswordProps;
          const id = `${stringHash(modkey)}.${panelIndex}`;
          const keyelem = document.getElementById(id);
          if (keyelem) {
            if (!Build.isWebApp) {
              scrollIntoView(keyelem, nbe, 40);
            }
            const dictlist = keyelem.parentNode
              ?.parentNode as HTMLElement | null;
            if (!Build.isWebApp && dictlist) {
              const dki = dictlist.getElementsByClassName(
                'dictkeyinput',
              ) as unknown as HTMLInputElement[] | null;
              if (dki) {
                dki[0].focus();
                dki[0].select();
              }
            }
          }
          sbe.dataset.scroll = scrollkey;
        }

        if (!renderPromise.waiting()) {
          // HIGHLIGHT
          if (
            (update || highlightkey !== sbe.dataset.highlightkey) &&
            !isPinned &&
            selection &&
            type === C.BIBLE
          ) {
            highlight(sbe, selection, module, renderPromise);
            sbe.dataset.highlightkey = highlightkey;
          }
          // TRIM NOTES
          if (columns > 1 && (update || doscroll)) {
            const empty = !trimNotes(sbe, nbe);
            const nbc = nbe.parentNode as any;
            if (
              (empty || !nbc.innerText) &&
              type !== 'Lexicons / Dictionaries'
            ) {
              nbc.classList.add('noteboxEmpty');
            } else nbc.classList.remove('noteboxEmpty');
          }
          // PREV / NEXT LINKS
          setTimeout(() => {
            const prev = textChange(atext, false, undefined, renderPromise);
            const next = textChange(atext, true, undefined, renderPromise);
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
      }
    }
    const d = diff(state, newState);
    if (Object.keys(newState).length && d) {
      this.setState(d);
    }
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
    flag: 'overwrite' | 'prepend' | 'append',
    xulswordState: AtextPropsType['xulswordState'],
    renderPromise: RenderPromise,
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
        i,
      );
      if (!Cache.has(libswordHash)) {
        Cache.write(
          libswordText(libswordProps, i, renderPromise, xulswordState),
          libswordHash,
        );
      }
      const response = Cache.read(libswordHash) as LibSwordResponse;
      if (renderPromise.waiting()) Cache.clear(libswordHash);
      else {
        log.silly(
          `${flag} panel ${i} ${verseKey(
            libswordProps.location || '',
            undefined,
            undefined,
            renderPromise,
          ).osisRef()}:`,
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
        // Web-app single panel needs to resize any outer iframe
        if (
          Build.isWebApp &&
          frameElement &&
          sbe?.parentElement &&
          (G.Prefs.getComplexValue('xulsword') as typeof S.prefs.xulsword)
            .panels.length === 1
        ) {
          const xsh = document.querySelector('html')?.clientHeight;
          if (xsh) {
            // Note: sbe.scrollHeight can be much greater than its content height.
            const bottom = sbe.lastElementChild?.getBoundingClientRect().bottom || 0;
            const top = sbe.firstElementChild?.getBoundingClientRect().top || 0;
            const scrollHeight = bottom - top
            let h = xsh - sbe.clientHeight + scrollHeight + 20;
            if (h < 800) h = 800;
            (frameElement as HTMLIFrameElement).height = `${h}px`;
          }
        }
      }
    }
  }

  render() {
    const state = this.state as AtextStateType;
    const props = this.props as AtextProps;
    const { renderPromise, handler } = this;
    const { maxNoteBoxHeight, versePerLine } = state;
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

    const showSelect = ilModule && ilModuleOption && ilModuleOption.length > 1;

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
          {!ownWindow && Build.isElectronApp && <div className="text-win" />}
        </div>

        <Box className="hd">
          <div className="navlink">
            <span className="navlink-span">{prevArrow}</span>
            <a className="prevchaplink">
              {GI.i18n.t('', renderPromise, 'PrevChaptext')}
            </a>{' '}
            <a className="nextchaplink">
              {GI.i18n.t('', renderPromise, 'NextChaptext')}
            </a>{' '}
            <span className="navlink-span">{nextArrow}</span>
          </div>
        </Box>

        {showSelect && (
          <Hbox className="origselect" pack="end">
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
            </select>
          </Hbox>
        )}

        {module &&
          audioIcon(
            module,
            isVerseKey ? location?.book || '' : modkey,
            location?.chapter,
            onAudioClick,
            renderPromise,
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
Atext.propTypes = propTypes;

export default Atext;

import React from 'react';
import VerseKey from '../../../verseKey.ts';
import { getElementData } from '../../htmlData.ts';
import Cache from '../../../cache.ts';
import C from '../../../constant.ts';
import {
  diff,
  JSON_attrib_stringify,
  keep,
  stringHash,
} from '../../../common.ts';
import { sanitizeHTML } from '../../../sanitizeHTML.ts';
import { G, GI } from '../../G.ts';
import {
  addHoverLinks,
  clearPending,
  createResizeObserver,
  doUntilDone,
  getMaxChapter,
  libswordImgSrc,
  moduleIncludesVariants,
  safeScrollIntoView,
} from '../../common.ts';
import RenderPromise from '../../renderPromise.ts';
import { addClass, topHandle, delayHandler } from '../libxul/xul.tsx';
import DragSizer from '../libxul/dragsizer.tsx';
import { Vbox, Hbox } from '../libxul/boxes.tsx';
import Spacer from '../libxul/spacer.tsx';
import Button from '../libxul/button.tsx';
import { libswordText, textChange } from './ztext.ts';
import {
  getScrollVerse,
  highlight,
  multiColumnVerseScroll,
  pageShowsLocation,
  versekeyScroll,
  trimNotes,
} from './zversekey.ts';
import {
  columnAnchor,
  columnBeforeAnchor,
  columnMetrics,
  columnOfAnchor,
  firstColumn,
  lastContentColumn,
  restoreColumn,
  scrollPage,
  scrollToColumn,
  scrollToFirstPage,
  scrollToLastPage,
  showLastPage,
  updateColumnSpacer,
} from './zcolumns.ts';
import { addTimingSpans } from '../../audioTiming.ts';
import handlerH from './atextH.ts';
import audioIcon from '../audioIcon/audioIcon.tsx';
import { getRootNode } from '../../rootNode.ts';
import '../../libsword.css';
import './atext.css';

import type {
  AudioPlayerFileGB,
  PinPropsType,
  PlaceType,
  AudioPlayerFileVK,
  GType,
  TextualVariantType,
} from '../../../type.ts';
import type S from '../../../defaultPrefs.ts';
import type {
  RenderPromiseComponent,
  RenderPromiseState,
} from '../../renderPromise.ts';
import type { HTMLData } from '../../htmlData.ts';
import type { XulProps } from '../libxul/xul.tsx';
import type { LibSwordResponse } from './ztext.ts';
import type { TextAnchor } from './zcolumns.ts';
import type { XulswordState } from '../xulsword/xulsword.tsx';
import type { popupParentHandler } from '../popup/popupParentH.ts';

export type AtextPropsType = Pick<
  typeof S.prefs.xulsword,
  'location' | 'selection' | 'scroll' | 'show' | 'place' | 'audio'
> & {
  showControls?: typeof S.prefs.xulsword.showControls;
  showChooser?: typeof S.prefs.xulsword.showChooser;

  modkey: string | null;

  module?: string | null;
  ilModule?: string | null;
  ilModuleOption: string[];

  isPinned: boolean;
  noteBoxHeight: number;
  minimizeNoteBox?: boolean;

  panelIndex: number;
  columns: number;
  ownWindow: boolean;

  popupParentHandler: typeof popupParentHandler;

  xulswordHandler?: (e: React.SyntheticEvent | PointerEvent) => void;

  xulswordState: React.Component<any, XulswordState>['setState'];

  onAudioClick: (
    selection: AudioPlayerFileVK | AudioPlayerFileGB | null,
    e: React.SyntheticEvent,
  ) => void;
  bbDragEnd: (e: PointerEvent, value: any) => void;
};

export type AtextProps = XulProps & AtextPropsType;

// The Atext props which effect LibSword output.
type LibSwordPropsType = Pick<
  AtextPropsType,
  | 'module'
  | 'ilModule'
  | 'ilModuleOption'
  | 'location'
  | 'modkey'
  | 'isPinned'
  | 'audio'
  | 'place'
  | 'show'
  | 'columns'
> & { variant?: TextualVariantType };

// Window arguments for each panel that are used in initial state must be
// updated here so that a component reset or program restart uses latest
// window state for each panel.
const windowState: Array<Partial<AtextStateType>> = [];

export const stateWinPrefs = {
  pin: null as PinPropsType | null,
  versePerLine: false as boolean,
  maxNoteBoxHeight: null as number | null,
  variants: undefined as typeof S.prefs.global.variants,
};

const notStateWinPrefs = {};

export type AtextStateType = typeof stateWinPrefs &
  typeof notStateWinPrefs &
  RenderPromiseState;

let ScrollOneTimeID = '';

// Publish the scripture box height to CSS, which uses it to limit the height
// of images (CSS percentages cannot refer to a multi-column box's height).
function setSbHeight(sbe: HTMLElement) {
  const height = `${sbe.clientHeight}px`;
  if (sbe.style.getPropertyValue('--sb-height') !== height)
    sbe.style.setProperty('--sb-height', height);
}

// XUL Atext
class Atext
  extends React.Component<AtextProps, AtextStateType>
  implements RenderPromiseComponent
{
  handler: typeof handlerH;

  wheelScrollTO: NodeJS.Timeout | undefined;

  sbref: React.RefObject<HTMLDivElement>;

  nbref: React.RefObject<HTMLDivElement>;

  renderPromise: RenderPromiseComponent['renderPromise'];

  loadingRef: React.RefObject<HTMLDivElement>;

  resizeObserver: ResizeObserver;

  // Where the showing page of a multi-column Bible began, while it is being
  // turned back a page (see turnPageBack).
  pageBackFrom: TextAnchor | null = null;

  constructor(props: AtextProps) {
    super(props);

    // Set this now rather than outside the component to allow time for web-app
    // prefs to take on their initial values.
    stateWinPrefs.variants = G.Prefs.getComplexValue(
      'global.variants',
    ) as typeof S.prefs.global.variants;

    this.state = {
      ...stateWinPrefs,
      ...notStateWinPrefs,
      ...windowState[props.panelIndex],
      renderPromiseID: 0,
    };

    this.sbref = React.createRef();
    this.nbref = React.createRef();

    this.onUpdate = this.onUpdate.bind(this);
    this.writeLibSword2DOM = this.writeLibSword2DOM.bind(this);
    this.handler = handlerH.bind(this);

    this.loadingRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);
    this.resizeObserver = createResizeObserver(() => this.onResize());
  }

  componentDidMount() {
    const { renderPromise, resizeObserver, sbref } = this;
    if (sbref.current) resizeObserver.observe(sbref.current);
    if (!renderPromise.waiting()) this.onUpdate();
    renderPromise.dispatch();
  }

  componentDidUpdate(_prevProps: AtextProps, prevState: AtextStateType) {
    const { props, state, renderPromise } = this;
    const { panelIndex } = props;
    windowState[panelIndex] = keep(
      state,
      Object.keys(stateWinPrefs) as Array<keyof typeof stateWinPrefs>,
    );
    const changedState = diff(prevState, windowState[panelIndex]);
    if (Build.isElectronApp && changedState) {
      (G as GType).Window.mergeValue(`atext${panelIndex}State`, changedState);
    }
    if (!renderPromise.waiting()) this.onUpdate();
    renderPromise.dispatch();
  }

  componentWillUnmount() {
    const { resizeObserver, sbref } = this;
    if (sbref.current) resizeObserver.unobserve(sbref.current);
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
    const { props, state, renderPromise } = this;
    const { columns, isPinned, panelIndex, show, xulswordState } = props;
    const { pin, maxNoteBoxHeight, versePerLine } = state;

    // Decide what needs to be updated...
    // pinProps are the currently active props according to the panel's
    // isPinned prop value, and libswordProps are those effecting LibSword
    // output.
    const { pinProps, libswordProps } = this.activeProps();
    // scrollProps are current props that effect scrolling
    const scrollProps = keep({ ...props, ...pinProps }, C.ScrollPropsVK);

    let newState = (
      diff(pin, pinProps) ? { pin: pinProps } : {}
    ) as AtextStateType;

    // Verse-per-line is misleading without verse numbers, so turn it off.
    if (versePerLine && !show.versenums) newState.versePerLine = false;

    const { sbref, nbref } = this;
    const sbe = sbref !== null ? sbref.current : null;
    const nbe = nbref !== null ? nbref.current : null;

    // Image height limits must be known before text is written and paged.
    if (sbe) setSbHeight(sbe);

    const atext = sbe?.parentNode as HTMLElement | null | undefined;

    const { selection, module } = pinProps;
    if (module && atext && sbe && nbe) {
      const { type, isVerseKey } = G.Tab[module];
      const scrollPropsKey = stringHash(scrollProps);
      const { scroll } = scrollProps;
      const { location, modkey } = libswordProps;
      const highlightkey = stringHash(selection);
      const multiColumnBible = columns > 1 && type === C.BIBLE;
      let update =
        this.textKey(libswordProps, panelIndex) !== sbe.dataset.libsword;
      // A multi-column Bible shows as many chapters as it takes to fill its
      // page. So when its location changes to another chapter than its first,
      // its text is written again unless its page already shows the location.
      if (
        !update &&
        multiColumnBible &&
        location &&
        scrollPropsKey !== sbe.dataset.scroll
      ) {
        update =
          location.chapter !== this.chapters(sbe)[0] &&
          !(
            'scroll' in sbe.dataset && pageShowsLocation(sbe, location, scroll)
          );
      }
      if (update) {
        this.writeLibSword2DOM(
          libswordProps,
          panelIndex,
          xulswordState,
          renderPromise,
        );
        updateColumnSpacer(sbe);
      }
      // Newly written text has not been positioned. Multi-column page
      // positions depend on image sizes, so they wait for images to load.
      const positioned = 'scroll' in sbe.dataset;
      const imagesLoading =
        columns > 1 && !positioned && this.waitForImages(sbe);
      // SCROLL (newly written multi-column Bibles are always positioned)
      const doScrollVerseKey =
        isVerseKey &&
        !imagesLoading &&
        (scroll || (multiColumnBible && !positioned)) &&
        (!positioned || scrollPropsKey !== sbe.dataset.scroll);
      if (doScrollVerseKey) {
        // Multi-column Bibles...
        if (!renderPromise.waiting()) {
          if (multiColumnBible && location) {
            multiColumnVerseScroll(sbe, location, !positioned);
          } else {
            if (Build.isWebApp) {
              const { userScrolled } = window.WebAppTextScroll;
              // If we got here because the user scrolled, don't update the
              // text that was scrolled.
              if (userScrolled !== panelIndex) {
                // versekeyScroll will set sbe.scrollTop, which will fire a
                // native 'scroll' event on sbe. Guard re-handling with
                // WebAppTextScroll until that event is finished.
                window.WebAppTextScroll.scriptScrolled = true;
                versekeyScroll(sbe, scrollProps);
                requestAnimationFrame(() => {
                  window.WebAppTextScroll.scriptScrolled = false;
                });
              }
            } else {
              versekeyScroll(sbe, scrollProps);
            }
          }
          if (!renderPromise.waiting()) sbe.dataset.scroll = scrollPropsKey;
        }
      } else if (
        !imagesLoading &&
        !positioned &&
        type === C.GENBOOK &&
        columns > 1
      ) {
        // Show the first page, or the last page after a previous page
        // change into the previous entry.
        if (showLastPage.delete(panelIndex)) scrollToLastPage(sbe);
        else scrollToFirstPage(sbe);
        sbe.dataset.scroll = '';
      } else if (update && type === C.DICTIONARY) {
        const id = `${stringHash(modkey)}.${panelIndex}`;
        const keyelem = getRootNode().getElementById(id);
        if (Build.isElectronApp && keyelem) {
          safeScrollIntoView(keyelem, nbe, undefined, 40);
          const dictlist = keyelem.parentNode?.parentNode as HTMLElement | null;
          if (dictlist) {
            const dki = dictlist.getElementsByClassName(
              'dictkeyinput',
            ) as unknown as HTMLInputElement[] | null;
            if (dki) {
              dki[0].focus();
              dki[0].select();
            }
          }
        }
      }

      if (!renderPromise.waiting()) {
        // PAGE (multi-column Bibles add chapters to fill their page. This
        // must not delay what follows, while it's waiting for a chapter)
        let added = false;
        if (multiColumnBible && 'scroll' in sbe.dataset) {
          // A previous page change turns back a page. Then the location
          // becomes the first verse on that page, as with any other page
          // change.
          if (this.turnPageBack(sbe, nbe, libswordProps, renderPromise)) {
            added = true;
            const firstloc = getScrollVerse(atext, renderPromise);
            if (firstloc) {
              const s = {
                location: firstloc,
                scroll: { verseAt: 'top' },
              } as const;
              if (isPinned) {
                newState = { ...newState, pin: { ...pinProps, ...s } };
              } else xulswordState(s);
            }
          }
          if (this.fillPage(sbe, nbe, libswordProps, renderPromise)) {
            added = true;
          }
        }
        // HIGHLIGHT
        if (
          (update || highlightkey !== sbe.dataset.highlightkey) &&
          !isPinned &&
          type === C.BIBLE
        ) {
          doUntilDone((rp) => {
            if (rp) highlight(sbe, selection, scroll, rp);
            if (!rp?.waiting()) sbe.dataset.highlightkey = highlightkey;
          });
        }
        // TRIM NOTES (whether the notebox shows is decided when text is
        // written, so that page layout doesn't change from page to page)
        if (columns > 1 && (update || doScrollVerseKey || added)) {
          this.trimPageNotes(sbe, nbe);
        }
        // PREV / NEXT LINKS
        this.updatePrevNextLinks(atext, sbe);
        // SCROLL INTO VIEW
        if (Build.isWebApp && update) {
          const { scrollIntoView } = scroll ?? {};
          const { selector, oneTimeID } = scrollIntoView ?? {};
          if (
            selector &&
            scrollIntoView &&
            oneTimeID &&
            ScrollOneTimeID !== oneTimeID
          ) {
            ScrollOneTimeID = oneTimeID;
            setTimeout(
              () =>
                getRootNode()
                  .querySelector(selector)
                  ?.scrollIntoView(scrollIntoView),
              100,
            );
          }
        }
      }
    }
    if (atext && sbe) {
      // Height has fixed maximum because single panel height resizes
      // to accomodate any notebox height!
      const maxHeight = Math.min(
        600,
        Math.round((sbe.parentElement?.offsetHeight ?? 200) / 2),
      );
      if (Math.abs(maxHeight - (maxNoteBoxHeight ?? 0)) > 2)
        newState.maxNoteBoxHeight = maxHeight;
    }
    const d = diff(state, newState);
    if (Object.keys(newState).length && d) {
      this.setState(d);
    }
    return true;
  }

  // The props which are currently active according to the panel's isPinned
  // prop value, and those of them which effect LibSword output.
  activeProps() {
    const { props, state, renderPromise } = this;
    const { columns, isPinned } = props;
    const { pin, variants } = state;
    const pinProps = keep(pin && isPinned ? pin : props, C.PinProps);
    const { module, ilModule } = pinProps;
    const { type = null, v11n = null } = (module && G.Tab[module]) || {};
    const keepme: ReadonlyArray<keyof AtextPropsType> = type
      ? C.LibSwordProps[type]
      : [];
    const libswordProps = {
      ...keep(
        {
          ...props,
          ...pinProps,
        },
        keepme,
      ),
      variant: module ? variants?.[ilModule || module] : undefined,
    };
    // A multi-column Bible shows other chapters besides that of its location,
    // so it is always located according to the versification of its module.
    const { location } = libswordProps;
    if (columns > 1 && type === C.BIBLE && location) {
      libswordProps.location = new VerseKey(location, renderPromise).location(
        v11n || null,
      );
    }
    return { pinProps, libswordProps };
  }

  // The notebox of a dictionary is its key list, which is never minimized.
  noteboxMinimized(): boolean {
    const { module, minimizeNoteBox } = this.props;
    return (
      !!minimizeNoteBox && !(module && G.Tab[module].type === C.DICTIONARY)
    );
  }

  // Where each type of note is shown. The notes of a minimized notebox cannot
  // be seen, so they are all shown in popups.
  notePlace(place: PlaceType): PlaceType {
    return this.noteboxMinimized()
      ? { footnotes: 'popup', crossrefs: 'popup', usernotes: 'popup' }
      : place;
  }

  // Read a LibSword response from the cache, or else from LibSword.
  libswordResponse(
    libswordProps: LibSwordPropsType,
    i: number,
    renderPromise: RenderPromise,
    xulswordState?: AtextPropsType['xulswordState'],
  ): LibSwordResponse {
    const libswordKey = this.libswordKey(libswordProps as AtextProps, i);
    if (Cache.has(libswordKey)) {
      return Cache.read(libswordKey) as LibSwordResponse;
    }
    const response = libswordText(
      libswordProps,
      i,
      renderPromise,
      xulswordState,
    );
    if (!renderPromise.waiting()) Cache.write(response, libswordKey);
    return response;
  }

  // Write a LibSword response to the DOM.
  writeLibSword2DOM(
    libswordProps: LibSwordPropsType,
    i: number,
    xulswordState: AtextPropsType['xulswordState'],
    renderPromise: RenderPromise,
  ) {
    const { sbref, nbref, navlinks } = this;
    const { module, audio, isPinned } = libswordProps;
    const sbe = sbref !== null ? sbref.current : null;
    const nbe = nbref !== null ? nbref.current : null;
    if (sbe && nbe) {
      const response = this.libswordResponse(
        libswordProps,
        i,
        renderPromise,
        xulswordState,
      );
      if (!renderPromise.waiting()) {
        const isDict =
          libswordProps.module &&
          G.Tab[libswordProps.module].type === C.DICTIONARY;
        let sb = response.textHTML;
        let nb = response.noteHTML;
        if (!isDict) nb = `<div class="fntable">${nb}</div>`;
        // Write nav-links to header
        const pes = sbe.parentElement?.querySelector(
          '.hd',
        ) as HTMLElement | null;
        if (module && pes && sbe.parentElement) {
          sanitizeHTML(pes, `${navlinks(module, renderPromise, true)}`);
          this.hoverLinks(pes);
          // UI TWEAK: Adjust nav-links down if they encroach on the controls
          const sbc = sbe.parentElement?.querySelector(
            '.sbcontrols',
          ) as HTMLElement | null;
          if (
            sbc &&
            sbe.parentElement.offsetWidth -
              2 * sbc.clientWidth -
              (pes.firstElementChild?.clientWidth ?? 0) <
              10
          ) {
            pes.style.marginTop = `${sbc.offsetHeight}px`;
          } else pes.style.marginTop = '';
          // UI TWEAK: Remove pesky arrows if atext is very narrow.
          if (sbe.parentElement?.offsetWidth < 210) {
            Array.from(
              pes.querySelectorAll('.prevchaplink, .nextchaplink'),
            ).forEach((e) => ((e as HTMLElement).style.display = 'none'));
          }
        }
        // Write nav-links to footer
        const { columns } = libswordProps;
        if (module && (typeof columns === 'undefined' || columns === 1))
          sb += `<div class="ft">${navlinks(module, renderPromise)}</div>`;
        // Write text to scripture box
        sanitizeHTML(sbe, sb);
        // Insert audio timing break spans if needed
        if (module && audio?.open && !isPinned) {
          const { file } = audio;
          if (file) {
            const { audioModule, timing } = file;
            if (
              audioModule &&
              timing &&
              !sbe.querySelector('.verse-sync') &&
              (G.Tab[module].audioCodes.includes(audioModule) ||
                module === audioModule)
            )
              addTimingSpans(sbe, timing);
          }
        }
        sbe.classList.toggle('has-sync', !!sbe.querySelector('.verse-sync'));
        this.readyText(sbe);
        sanitizeHTML(nbe, nb);
        libswordImgSrc(nbe);
        this.hoverLinks(nbe);
        const nbc = nbe.parentNode as any;
        const fntable = nbe.firstChild as HTMLElement | null;
        if (!fntable?.innerText && !isDict) nbc.classList.add('noteboxEmpty');
        else nbc.classList.remove('noteboxEmpty');

        if (!renderPromise.waiting()) {
          const chapter = libswordProps.location?.chapter ?? 0;
          sbe.dataset.libsword = this.textKey(libswordProps, i);
          sbe.dataset.chapters = `${chapter}-${chapter}`;
          delete sbe.dataset.scroll;
          delete sbe.dataset.column;
          delete sbe.dataset.highlightkey;
        }
      }
    }
  }

  // Ready LibSword text which has just been written to an element.
  readyText(div: HTMLElement) {
    // Tag elements that CSS would otherwise need :has() to match.
    div
      .querySelectorAll<HTMLElement>('.x-navmenu .item .x-right')
      .forEach((el) => {
        if (el.nextElementSibling?.tagName === 'SPAN') {
          el.classList.add('has-next-span');
        }
      });
    // Update all image paths
    libswordImgSrc(div);
    this.hoverLinks(div);
  }

  // The first and last chapters of the text in the sb of a multi-column
  // Bible, which shows as many chapters as it takes to fill its page.
  chapters(sbe: HTMLElement): [number, number] {
    const [first, last] = (sbe.dataset.chapters ?? '').split('-').map(Number);
    return [first || 0, last || 0];
  }

  // Add the chapter which follows (or else precedes) the text of a multi-
  // column Bible. Returns the nodes which were added, or null if there is no
  // such chapter, or if its text is not available yet.
  addChapter(
    sbe: HTMLElement,
    nbe: HTMLElement,
    libswordProps: LibSwordPropsType,
    next: boolean,
    renderPromise: RenderPromise,
  ): ChildNode[] | null {
    const { location } = libswordProps;
    const [first, last] = this.chapters(sbe);
    if (!location?.v11n || !first || renderPromise.waiting()) return null;
    // (a box which is not laid out has no columns to fill, and so would take
    // every chapter of the book)
    if (!sbe.clientWidth || !sbe.clientHeight) return null;
    const { book, v11n } = location;
    const chapter = next ? last + 1 : first - 1;
    if (chapter < 1 || chapter > getMaxChapter(v11n, book, renderPromise)) {
      return null;
    }
    const response = this.libswordResponse(
      { ...libswordProps, location: { book, chapter, verse: 1, v11n } },
      this.props.panelIndex,
      renderPromise,
    );
    if (renderPromise.waiting()) return null;
    const text = sanitizeHTML(document.createElement('div'), response.textHTML);
    this.readyText(text);
    const notes = sanitizeHTML(
      document.createElement('div'),
      response.noteHTML,
    );
    libswordImgSrc(notes);
    this.hoverLinks(notes);
    const textNodes = Array.from(text.childNodes);
    const noteNodes = Array.from(notes.childNodes);
    const fntable = nbe.firstElementChild;
    if (next) {
      // (text goes before the column spacer)
      const spacer = sbe.lastElementChild;
      if (spacer?.classList.contains('col-spacer')) spacer.before(...textNodes);
      else sbe.append(...textNodes);
      fntable?.append(...noteNodes);
    } else {
      sbe.prepend(...textNodes);
      fntable?.prepend(...noteNodes);
    }
    if (notes.textContent) {
      nbe.parentElement?.classList.remove('noteboxEmpty');
    }
    sbe.dataset.chapters = next ? `${first}-${chapter}` : `${chapter}-${last}`;
    delete sbe.dataset.highlightkey;
    return [...textNodes, ...noteNodes];
  }

  // Add chapters to the text of a multi-column Bible until its page is filled,
  // or the end of the book is reached. Returns true if any were added.
  fillPage(
    sbe: HTMLElement,
    nbe: HTMLElement,
    libswordProps: LibSwordPropsType,
    renderPromise: RenderPromise,
  ): boolean {
    const m = columnMetrics(sbe);
    let added = false;
    while (
      m &&
      lastContentColumn(sbe, m) < firstColumn(sbe, m) + m.columns &&
      this.addChapter(sbe, nbe, libswordProps, true, renderPromise)
    ) {
      added = true;
    }
    return added;
  }

  // Begin turning a multi-column Bible back a page (see turnPageBack).
  pageBack() {
    const sbe = this.sbref.current;
    const m = sbe && columnMetrics(sbe);
    if (sbe && m) {
      this.pageBackFrom = columnAnchor(sbe, m, firstColumn(sbe, m));
      this.forceUpdate();
    }
  }

  // Turn a multi-column Bible back to the page which ends where the showing
  // page began, adding as many preceding chapters as it takes to fill that
  // page. Text added before the showing page moves it to other columns, so
  // nothing is to change until the new page is ready: if a chapter is not
  // available yet, those already added are removed again until it is.
  // Returns true once the page has been turned.
  turnPageBack(
    sbe: HTMLElement,
    nbe: HTMLElement,
    libswordProps: LibSwordPropsType,
    renderPromise: RenderPromise,
  ): boolean {
    const { pageBackFrom: from } = this;
    if (!from) return false;
    const m = columnMetrics(sbe);
    const nbc = nbe.parentElement;
    if (!m || !nbc || !sbe.contains(from.element)) {
      this.pageBackFrom = null;
      return false;
    }
    const { chapters } = sbe.dataset;
    const noteboxEmpty = nbc.classList.contains('noteboxEmpty');
    const showing = firstColumn(sbe, m);
    const added: ChildNode[] = [];
    // The new page ends with the column where the text before the showing
    // page ends.
    const column = () => columnBeforeAnchor(sbe, m, from) - m.columns + 1;
    while (column() < 0) {
      const nodes = this.addChapter(
        sbe,
        nbe,
        libswordProps,
        false,
        renderPromise,
      );
      if (!nodes) break;
      added.push(...nodes);
    }
    if (renderPromise.waiting()) {
      added.forEach((node) => node.remove());
      sbe.dataset.chapters = chapters;
      nbc.classList.toggle('noteboxEmpty', noteboxEmpty);
      scrollToColumn(sbe, m, showing);
      return false;
    }
    // The new page's columns depend on image sizes. So keep showing the same
    // text until images have loaded.
    if (this.waitForImages(sbe)) {
      scrollToColumn(sbe, m, columnOfAnchor(sbe, m, from));
      return false;
    }
    this.pageBackFrom = null;
    scrollToColumn(sbe, m, column());
    return added.length > 0 || firstColumn(sbe, m) !== showing;
  }

  // Returns true if any images in sbe are still loading, and arranges for
  // onUpdate to run again once they have all loaded (or failed).
  waitForImages(sbe: HTMLElement): boolean {
    const loading = Array.from(sbe.getElementsByTagName('img')).filter(
      (img) => !img.complete,
    );
    if (!loading.length) return false;
    const { libsword } = sbe.dataset;
    if (sbe.dataset.imagesLoading !== libsword) {
      sbe.dataset.imagesLoading = libsword;
      let count = loading.length;
      const done = () => {
        count -= 1;
        if (!count && sbe.dataset.imagesLoading === libsword) {
          delete sbe.dataset.imagesLoading;
          if (this.sbref.current === sbe) this.forceUpdate();
        }
      };
      loading.forEach((img) => {
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      });
    }
    return true;
  }

  // Multi-column panels keep their columns aligned to the page, and Bibles
  // keep their location verse showing, when the scripture box is resized.
  onResize() {
    const { props, sbref } = this;
    const sbe = sbref.current;
    if (sbe && sbe.dataset.libsword) {
      setSbHeight(sbe);
      updateColumnSpacer(sbe);
      if (props.columns > 1) {
        restoreColumn(sbe);
        const { module, location } = this.activeProps().libswordProps;
        if (module && G.Tab[module].type === C.BIBLE && location) {
          multiColumnVerseScroll(sbe, location, false);
        }
        this.onPageScroll();
      }
    }
  }

  // Multi-column panels page by scrolling, so update their notes and prev/next
  // links whenever they scroll (or their text is laid out again). And Bibles
  // must add chapters whenever their page is no longer filled.
  onPageScroll() {
    const { props, sbref, nbref, renderPromise } = this;
    const { columns, panelIndex } = props;
    const sbe = sbref.current;
    const nbe = nbref.current;
    const atext = sbe?.parentElement;
    if (sbe && nbe && atext && columns > 1) {
      const { libswordProps } = this.activeProps();
      const { module } = libswordProps;
      if (
        module &&
        G.Tab[module].type === C.BIBLE &&
        'scroll' in sbe.dataset &&
        this.textKey(libswordProps, panelIndex) === sbe.dataset.libsword
      ) {
        this.fillPage(sbe, nbe, libswordProps, renderPromise);
        // (if a chapter was not available, onUpdate will add it when it is)
        renderPromise.dispatch();
      }
      this.trimPageNotes(sbe, nbe);
      this.updatePrevNextLinks(atext, sbe);
    }
  }

  // Trim the notes of a multi-column panel to those of its showing page. If
  // that leaves none, the notebox is flagged so that its bar can be hidden
  // while it is minimized.
  trimPageNotes(sbe: HTMLElement, nbe: HTMLElement) {
    const haveNotes = trimNotes(sbe, nbe);
    nbe.parentElement?.classList.toggle('noteboxPageEmpty', !haveNotes);
  }

  // Enable or disable the prev/next links, after a delay.
  updatePrevNextLinks(atext: HTMLElement, sbe: HTMLElement) {
    delayHandler(
      this,
      () => {
        doUntilDone((rp) => {
          if (rp) {
            const prev =
              scrollPage(sbe, false, true) || textChange(atext, false, rp);
            const next =
              scrollPage(sbe, true, true) || textChange(atext, true, rp);
            if (!rp.waiting()) {
              if (prev) atext.classList.remove('prev-disabled');
              else atext.classList.add('prev-disabled');
              if (next) atext.classList.remove('next-disabled');
              else atext.classList.add('next-disabled');
            }
          }
        });
      },
      [],
      C.UI.Atext.prevNextDelay,
      'prevNextLinkUpdate',
    );
  }

  hoverLinks(div: HTMLElement) {
    const { props, handler } = this;
    const { popupParentHandler } = props;
    addHoverLinks(
      div,
      [
        'cr',
        'fn',
        'un',
        'sn',
        'sr',
        'dt',
        'dtl',
        'introlink',
        'aboutlink',
        'searchterm',
      ],
      popupParentHandler,
    );
    addHoverLinks(div, ['cr', 'fn', 'sn', 'un', 'image-viewport'], handler);
  }

  // IMPORTANT: verse doesn't effect libsword output, so always remove
  // it from stringHash for a big speedup.
  libswordKey(libswordProps: AtextProps, panelIndex: number): string {
    return stringHash(
      {
        ...libswordProps,
        location: { ...libswordProps.location, verse: 0 },
      },
      panelIndex,
    );
  }

  // The key of the text in sb. A multi-column Bible shows as many chapters as
  // it takes to fill its page, so its key is the same for every location in a
  // book.
  textKey(libswordProps: LibSwordPropsType, panelIndex: number): string {
    const { module, columns, location } = libswordProps;
    if (module && G.Tab[module].type === C.BIBLE && columns > 1 && location) {
      const { book, v11n } = location;
      return stringHash(
        { ...libswordProps, location: { book, v11n } },
        panelIndex,
      );
    }
    return this.libswordKey(libswordProps as AtextProps, panelIndex);
  }

  navlinks(
    module: string,
    renderPromise: RenderPromise,
    showAboutLink = false,
  ) {
    const appIsRTL = G.ProgramConfig?.direction === 'rtl';
    const prevArrow = appIsRTL
      ? String.fromCharCode(10095)
      : String.fromCharCode(10094);
    const nextArrow = appIsRTL
      ? String.fromCharCode(10094)
      : String.fromCharCode(10095);
    return (
      `
    <div class="navlink" dir="${appIsRTL ? 'rtl' : 'ltr'}">
      <span class="prevchaplink">${prevArrow}</span>` +
      (showAboutLink
        ? `
      <span class="aboutlink" data-data=${JSON_attrib_stringify({
        type: 'aboutlink',
        context: module,
      })}
      >
        ${GI.i18n.t('', renderPromise, 'About this text', { ns: 'bibleBrowser' })}
      </span>`
        : '') +
      `<span class="nextchaplink">${nextArrow}</span>
    </div>`
    );
  }

  render() {
    const { props, state, renderPromise, loadingRef, handler } = this;
    const { maxNoteBoxHeight, versePerLine, variants } = state;
    const {
      columns,
      isPinned,
      location,
      module,
      modkey,
      panelIndex,
      audio,
      ownWindow,
      noteBoxHeight,
      showChooser,
      showControls,
      ilModuleOption,
      ilModule,
      show,
      selection,
      onAudioClick,
      bbDragEnd,
      xulswordHandler,
    } = props;

    // Header logic etc.
    const isVerseKey = module && G.Tab[module].isVerseKey;

    // Notebox height
    const doMinimizeNB = this.noteboxMinimized();
    let realNoteBoxHeight = noteBoxHeight;
    if (maxNoteBoxHeight && realNoteBoxHeight > maxNoteBoxHeight)
      realNoteBoxHeight = maxNoteBoxHeight;

    const moduleAlwaysVersePerLine =
      module && G.FeatureModules.NoParagraphs.includes(module);

    const variantModule = ilModule || module;
    const showVariantSelect =
      variantModule && moduleIncludesVariants(variantModule, renderPromise);
    const variant: TextualVariantType =
      (variantModule && variants?.[variantModule]) || 'Primary Reading';

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
    if (module && G.Tab[module].direction === 'rtl') classes.push('rtl');
    if (isPinned) classes.push('pinned');
    if (doMinimizeNB) classes.push('noteboxMinimized');
    if ((versePerLine && show.versenums) || moduleAlwaysVersePerLine) {
      if (!module || G.Tab[module].tabType === 'Texts') {
        classes.push('verse-per-line');
      } else classes.push('verse-per-line-com');
      if (moduleAlwaysVersePerLine) classes.push('always-vpl');
    }
    if (show.headings) classes.push('headings');
    if (showVariantSelect) {
      if (variant === 'Secondary Reading') classes.push('variant');
      else if (variant === 'All Readings') classes.push('both-variants');
    }

    const data: HTMLData = { type: 'text' };
    if (module && ['Dicts', 'Genbks'].includes(G.Tab[module].tabType)) {
      if (module && modkey) data.locationGB = { otherMod: module, key: modkey };
    } else if (location)
      data.location = { ...location, vkMod: module ?? undefined };

    const showSelect =
      !isPinned &&
      module &&
      G.Tab[module].type === C.BIBLE &&
      ilModule &&
      ilModuleOption &&
      ilModuleOption.length > 1;

    const webAppIconSize = Build.isWebApp ? 28 : C.UI.BluePrint.IconSize.LARGE;

    return (
      <Vbox
        domref={loadingRef}
        {...addClass(classes, props)}
        {...topHandle('onDoubleClick', handler, props)}
        {...topHandle('onPointerEnter', handler, props)}
        {...topHandle('onPointerDown', handler, props)}
        {...topHandle('onPointerLeave', handler, props)}
        {...topHandle('onChange', handler, props)}
        {...topHandle('onWheel', handler, props)}
        data-index={panelIndex}
        data-module={module}
        data-columns={columns}
        data-ispinned={isPinned}
        data-ilmodule={ilModule}
        data-verse={selection?.verse ?? ''}
        data-data={JSON_attrib_stringify(data)}
      >
        <Hbox className="sbcontrols">
          {xulswordHandler &&
            typeof showChooser !== 'undefined' &&
            window.innerWidth > C.UI.WebApp.mobileW && (
              <Button
                className="chooserButton"
                checked={showChooser}
                icon={showChooser ? 'menu-closed' : 'menu-open'}
                iconSize={webAppIconSize}
                onPointerDown={xulswordHandler}
                title={GI.i18n.t(
                  '',
                  renderPromise,
                  'Show or hide the verse chooser tool.',
                  { ns: 'bibleBrowser' },
                )}
              />
            )}
          {xulswordHandler && typeof showControls !== 'undefined' && (
            <Button
              className="showControls"
              icon="cog"
              onPointerDown={xulswordHandler}
              checked={showControls ?? false}
            />
          )}
          {isVerseKey && (
            <Button
              className="text-pin"
              checked={!!isPinned}
              icon={isPinned ? 'unpin' : 'pin'}
              iconSize={webAppIconSize}
            />
          )}
          {module &&
            audioIcon({
              swordModule: module,
              bookOrKey: isVerseKey ? (location?.book ?? '') : (modkey ?? ''),
              chapter: location?.chapter,
              audio,
              audioHandler: onAudioClick,
              renderPromise,
              button: true,
              // disableIfNoAudio: true
            })}
          {!ownWindow && Build.isElectronApp && (
            <Button className="towindow" icon="open-application" />
          )}
          {showSelect && (
            <Hbox className="origselect" pack="end">
              <select
                key={ilModule}
                defaultValue={ilModule}
                onPointerDown={handler}
              >
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
          {showVariantSelect && (
            <Hbox className="variantselect" pack="end">
              <select
                key={variant}
                defaultValue={variant}
                onPointerDown={handler}
                title={GI.i18n.t('', renderPromise, 'Textual variants', {
                  ns: 'bibleBrowser',
                })}
              >
                {Object.entries(C.TextualVariantLabels).map(([v, label]) => {
                  return (
                    <option key={v} value={v}>
                      {GI.i18n.t('', renderPromise, label, {
                        ns: 'bibleBrowser',
                      })}
                    </option>
                  );
                })}
              </select>
            </Hbox>
          )}
        </Hbox>

        <Hbox align="center" className="hd" />

        <Vbox
          className="sb"
          style={columns > 1 ? { columnCount: columns } : undefined}
          domref={this.sbref}
          pack="start"
          flex="1"
          dir={(module && G.Tab[module].direction) || 'auto'}
          onScroll={handler}
        />

        <Vbox
          className="nbc"
          height={doMinimizeNB ? undefined : realNoteBoxHeight}
        >
          <Hbox className="nbbar" pack={'center'}>
            <DragSizer
              // A minimized notebox is only as high as its bar.
              onDragStart={() =>
                doMinimizeNB ? C.UI.Atext.bbBottomMargin : realNoteBoxHeight
              }
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

export default Atext;

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
  highlight,
  multiColumnVerseScroll,
  versekeyScroll,
  trimNotes,
} from './zversekey.ts';
import {
  restoreColumn,
  scrollPage,
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
  maximizeNoteBox: boolean;

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
    const { pin, maxNoteBoxHeight, variants, versePerLine } = state;

    // Decide what needs to be updated...
    // pinProps are the currently active props according to the panel's
    // isPinned prop value.
    const pinProps = keep(pin && isPinned ? pin : props, C.PinProps);
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

    // Adjust maxNoteBoxHeight height if needed
    const atext = sbe?.parentNode as HTMLElement | null | undefined;
    if (atext && sbe) {
      let maxHeight = sbe.offsetHeight;
      if (columns === 1) maxHeight -= C.UI.Atext.bbSingleColTopMargin;
      else {
        // The notebox is below the text columns. Its maximum takes the same
        // area as one column.
        const nbc = atext.querySelector('.nbc') as HTMLElement | null;
        maxHeight = Math.round(
          (maxHeight + (nbc?.offsetHeight ?? 0)) / columns,
        );
        if (Math.abs(maxHeight - (maxNoteBoxHeight ?? 0)) > 2)
          newState.maxNoteBoxHeight = maxHeight;
      }
    }

    const { selection, module, ilModule } = pinProps;
    if (module && atext && sbe && nbe) {
      const { type, isVerseKey } = G.Tab[module];
      const scrollPropsKey = stringHash(scrollProps);
      // libswordProps contains current values effecting LibSword output
      const keepme: ReadonlyArray<keyof AtextPropsType> = C.LibSwordProps[type];
      const libswordProps = {
        ...keep(
          {
            ...props,
            ...pinProps,
          },
          keepme,
        ),
        variant: variants?.[ilModule || module],
      };
      const { scroll } = scrollProps;
      const { location, modkey } = libswordProps;
      const highlightkey = stringHash(selection);
      const libswordKey = this.libswordKey(libswordProps, panelIndex);
      const skipUpdate =
        scroll?.verseAt === 'bottom' && (columns === 1 || type !== C.BIBLE);
      if (libswordProps && !skipUpdate) {
        const update = libswordKey !== sbe.dataset.libsword;
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
        const multiColumnBible = columns > 1 && type === C.BIBLE;
        const doScrollVerseKey =
          isVerseKey &&
          !imagesLoading &&
          (scroll || (multiColumnBible && !positioned)) &&
          (!positioned || scrollPropsKey !== sbe.dataset.scroll);
        if (doScrollVerseKey) {
          // Multi-column Bibles...
          if (!renderPromise.waiting()) {
            if (multiColumnBible && location) {
              const firstloc = multiColumnVerseScroll(
                sbe,
                location,
                scroll?.verseAt ?? 'top',
                !positioned,
                renderPromise,
              );
              // A previous page change into the previous chapter shows its
              // last page. Then the location becomes the first verse on that
              // page, as with any other page change.
              if (firstloc) {
                const s = {
                  location: firstloc,
                  scroll: { verseAt: 'top' },
                } as const;
                if (isPinned) {
                  newState = { ...newState, pin: { ...pinProps, ...s } };
                } else xulswordState(s);
              }
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
            const dictlist = keyelem.parentNode
              ?.parentNode as HTMLElement | null;
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
          if (columns > 1 && (update || doScrollVerseKey)) trimNotes(sbe, nbe);
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
      | 'isPinned'
      | 'audio'
      | 'place'
      | 'show'
      | 'columns'
    > & { variant?: TextualVariantType },
    i: number,
    xulswordState: AtextPropsType['xulswordState'],
    renderPromise: RenderPromise,
  ) {
    const { sbref, nbref, navlinks } = this;
    const { module, audio, isPinned } = libswordProps;
    const sbe = sbref !== null ? sbref.current : null;
    const nbe = nbref !== null ? nbref.current : null;
    if (sbe && nbe) {
      const libswordKey = this.libswordKey(libswordProps as AtextProps, i);
      let response;
      if (!Cache.has(libswordKey)) {
        response = libswordText(libswordProps, i, renderPromise, xulswordState);
        if (!renderPromise.waiting()) Cache.write(response, libswordKey);
      } else {
        response = Cache.read(libswordKey) as LibSwordResponse;
      }
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
        // Tag elements that CSS would otherwise need :has() to match.
        sbe
          .querySelectorAll<HTMLElement>('.x-navmenu .item .x-right')
          .forEach((el) => {
            if (el.nextElementSibling?.tagName === 'SPAN') {
              el.classList.add('has-next-span');
            }
          });
        sbe.classList.toggle('has-sync', !!sbe.querySelector('.verse-sync'));
        // Update all image paths
        libswordImgSrc(sbe);
        this.hoverLinks(sbe);
        sanitizeHTML(nbe, nb);
        libswordImgSrc(nbe);
        this.hoverLinks(nbe);
        const nbc = nbe.parentNode as any;
        const fntable = nbe.firstChild as HTMLElement | null;
        if (!fntable?.innerText && !isDict) nbc.classList.add('noteboxEmpty');
        else nbc.classList.remove('noteboxEmpty');

        if (!renderPromise.waiting()) {
          sbe.dataset.libsword = libswordKey;
          delete sbe.dataset.scroll;
          delete sbe.dataset.column;
          delete sbe.dataset.highlightkey;
        }
      }
    }
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
    const { props, state, sbref, renderPromise } = this;
    const sbe = sbref.current;
    if (sbe && sbe.dataset.libsword) {
      setSbHeight(sbe);
      updateColumnSpacer(sbe);
      if (props.columns > 1) {
        restoreColumn(sbe);
        const { pin } = state;
        const { isPinned } = props;
        const { module, location, scroll } = pin && isPinned ? pin : props;
        // (after 'bottom', the restored column is the page to keep)
        if (
          module &&
          G.Tab[module].type === C.BIBLE &&
          location &&
          scroll?.verseAt !== 'bottom'
        ) {
          multiColumnVerseScroll(sbe, location, 'top', false, renderPromise);
        }
      }
    }
  }

  // Multi-column panels page by scrolling, so update their notes and prev/next
  // links whenever they scroll.
  onPageScroll() {
    const { props, sbref, nbref } = this;
    const sbe = sbref.current;
    const nbe = nbref.current;
    const atext = sbe?.parentElement;
    if (sbe && nbe && atext && props.columns > 1) {
      trimNotes(sbe, nbe);
      this.updatePrevNextLinks(atext, sbe);
    }
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
      maximizeNoteBox,
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
    const doMaximizeNB = columns !== 1 && maximizeNoteBox;
    let realNoteBoxHeight = noteBoxHeight;
    if (
      maxNoteBoxHeight &&
      (doMaximizeNB || realNoteBoxHeight > maxNoteBoxHeight)
    )
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
    if (doMaximizeNB) classes.push('noteboxMaximized');
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

        <Vbox className="nbc" height={realNoteBoxHeight}>
          <Hbox pack={'center'}>
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

export default Atext;

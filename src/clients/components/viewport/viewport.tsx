import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import Subscription from '../../../subscription.ts';
import C from '../../../constant.ts';
import {
  getPanelWidths,
  ofClass,
  randomID,
  stringHash,
} from '../../../common.ts';
import Popup from '../popup/popup.tsx';
import {
  popupParentHandler as popupParentHandlerH,
  popupHandler as popupHandlerH,
  popupUpClickClose as popupUpClickCloseH,
  PopupParentInitState,
} from '../popup/popupParentH.ts';
import { G, GI } from '../../G.ts';
import Commands from '../../commands.ts';
import RenderPromise from '../../renderPromise.ts';
import log from '../../log.ts';
import verseKey from '../../verseKey.ts';
import { clearPending } from '../../common.tsx';
import { addClass, xulPropTypes, topHandle } from '../libxul/xul.tsx';
import { Hbox, Vbox } from '../libxul/boxes.tsx';
import Chooser from '../chooser/chooser.tsx';
import GenbookChooser from '../genbookChooser/genbookChooser.tsx';
import Tabs from '../tabs/tabs.tsx';
import Atext from '../atext/atext.tsx';
import './viewport.css';

import type { SyntheticEvent } from 'react';
import type {
  AudioPlayerSelectionGB,
  LocationVKType,
  AudioPlayerSelectionVK,
  XulswordStateArgType,
} from '../../../type.ts';
import type S from '../../../defaultPrefs.ts';
import type { RenderPromiseState } from '../../renderPromise.ts';
import type { XulProps } from '../libxul/xul.tsx';
import type {
  PopupParent,
  PopupParentState,
  ViewportPopupProps,
} from '../popup/popupParentH.ts';

const propTypes = {
  ...xulPropTypes,
  location: PropTypes.object,
  selection: PropTypes.object,
  scroll: PropTypes.object,
  audio: PropTypes.object.isRequired,

  keys: PropTypes.arrayOf(PropTypes.string).isRequired,

  show: PropTypes.object.isRequired,
  place: PropTypes.object.isRequired,

  showChooser: PropTypes.bool.isRequired,
  tabs: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)).isRequired,
  panels: PropTypes.arrayOf(PropTypes.string).isRequired,
  ilModules: PropTypes.arrayOf(PropTypes.string).isRequired,
  mtModules: PropTypes.arrayOf(PropTypes.string).isRequired,

  isPinned: PropTypes.arrayOf(PropTypes.bool).isRequired,
  noteBoxHeight: PropTypes.arrayOf(PropTypes.number).isRequired,
  maximizeNoteBox: PropTypes.arrayOf(PropTypes.bool).isRequired,
  ownWindow: PropTypes.bool.isRequired,

  eHandler: PropTypes.func.isRequired,
  bbDragEnd: PropTypes.func.isRequired,
  xulswordStateHandler: PropTypes.func.isRequired,
  atextRefs: PropTypes.arrayOf(PropTypes.object),
};

type ViewportProps = ViewportPopupProps &
  XulProps & {
    location: typeof S.prefs.xulsword.location;
    selection: typeof S.prefs.xulsword.selection;
    scroll: typeof S.prefs.xulsword.scroll;
    audio: typeof S.prefs.xulsword.audio;
    keys: typeof S.prefs.xulsword.keys;
    showChooser: typeof S.prefs.xulsword.showChooser;
    tabs: typeof S.prefs.xulsword.tabs;
    panels: typeof S.prefs.xulsword.panels;
    ilModules: typeof S.prefs.xulsword.ilModules;
    mtModules: typeof S.prefs.xulsword.mtModules;
    noteBoxHeight: typeof S.prefs.xulsword.noteBoxHeight;
    maximizeNoteBox: typeof S.prefs.xulsword.maximizeNoteBox;
    ownWindow: boolean;

    eHandler: (e: React.SyntheticEvent) => void;
    bbDragEnd: (e: React.MouseEvent, value: any) => void;
    xulswordStateHandler: (s: XulswordStateArgType) => void;
  };

type ViewportState = PopupParentState &
  RenderPromiseState & {
    reset: number;
  };

class Viewport extends React.Component implements PopupParent {
  static propTypes: typeof propTypes;

  popupParentHandler: typeof popupParentHandlerH;

  popupHandler: typeof popupHandlerH;

  popupUpClickClose: typeof popupUpClickCloseH;

  popupDelayTO: PopupParent['popupDelayTO'];

  popupUnblockTO: PopupParent['popupUnblockTO'];

  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLDivElement>;

  popupRef: React.RefObject<Popup>;

  constructor(props: ViewportProps) {
    super(props);

    const s: ViewportState = {
      ...PopupParentInitState,
      reset: 0,
      renderPromiseID: 0,
    };
    this.state = s;

    this.popupParentHandler = popupParentHandlerH.bind(this);
    this.popupHandler = popupHandlerH.bind(this);
    this.audioHandler = this.audioHandler.bind(this);
    this.popupUpClickClose = popupUpClickCloseH.bind(this);

    this.loadingRef = React.createRef();
    this.popupRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);
  }

  componentDidUpdate() {
    const { renderPromise } = this;
    const state = this.state as ViewportState;
    const { popupParent, elemdata } = state;
    if (popupParent && !document.body.contains(popupParent)) {
      this.setState({ popupParent: null });
    } else if (popupParent && elemdata?.length) {
      // Do the fade in effect
      popupParent.getElementsByClassName('npopup')[0]?.classList.remove('hide');
    }
    renderPromise.dispatch();
    this.popupUpClickClose();
  }

  componentWillUnmount() {
    clearPending(this, ['popupDelayTO', 'popupUnblockTO']);
    this.popupUpClickClose(true);
  }

  audioHandler(
    selection: AudioPlayerSelectionVK | AudioPlayerSelectionGB | null,
    e: React.SyntheticEvent,
  ) {
    const { audio } = this.props as ViewportProps;
    const { open, defaults } = audio;
    const atextClick = !!ofClass(['textarea'], e.target)?.element;
    let file:
      | AudioPlayerSelectionVK
      | AudioPlayerSelectionGB
      | null
      | undefined;
    if (selection && (!atextClick || !audio.open)) file = selection;
    if (!selection || (atextClick && audio.open)) file = null;
    if (typeof file !== 'undefined') {
      // The actual audio file may be changed during viewportParent rendering,
      // because at that time all available audio file options are again
      // collected and a single option will be selected according to current
      // defaults.
      void Commands.playAudio({ open, file, defaults });
    }
  }

  render() {
    const { renderPromise, loadingRef, popupRef, popupHandler, audioHandler } =
      this;
    const props = this.props as ViewportProps;
    const state = this.state as ViewportState;
    const {
      location,
      selection,
      keys,
      show,
      place,
      tabs,
      panels,
      ilModules: ilModules0,
      mtModules,
      scroll,
      isPinned: isPinned0,
      noteBoxHeight,
      maximizeNoteBox,
      showChooser,
      ownWindow,
      eHandler,
      bbDragEnd,
      xulswordStateHandler,
      atextRefs,
    } = this.props as ViewportProps;
    const { reset, elemdata, gap, popupParent, popupReset } = state;

    const tabcntl = G.Prefs.getBoolPref('xulsword.tabcntl');

    const Book = G.Book(G.i18n.language);

    // Only versekey panels can be pinned
    const isVerseKey = panels.map((m) => Boolean(m && G.Tab[m].isVerseKey));
    const isPinned = panels.map((_m, i) => isPinned0[i] && isVerseKey[i]);

    const firstUnpinnedBible = panels.find((m, i) => {
      return m && !isPinned[i] && G.Tab[m].type === C.BIBLE;
    });

    // Get all available books from unpinned versekey modules
    const availableBooks = new Set();
    panels.forEach((m, i) => {
      if (m && !isPinned[i] && G.Tab[m].isVerseKey) {
        GI.getBooksInVKModule(
          G.Books().map((b) => b.code),
          renderPromise,
          m,
        ).forEach((bk) => availableBooks.add(bk));
      }
    });

    // Get each panel's interlinear module options according to testament
    const ilModuleOptions = panels.map(() => ['']);
    const panelHasILOptions = panels.map(() => false);
    panels.forEach((_panel: string | null, i: number) => {
      const tabbank = tabs[i];
      const panelHasBible =
        tabbank &&
        tabbank.some((t) => {
          return G.Tab[t].type === C.BIBLE;
        });
      if (panelHasBible && location?.book) {
        panelHasILOptions[i] = Boolean(
          G.FeatureModules.hebrew[0] || G.FeatureModules.greek[0],
        );
        const bk = location.book in Book ? Book[location.book] : null;
        if (bk) {
          const ml = G.FeatureModules.hebrew
            .concat(G.FeatureModules.greek)
            .filter((m) =>
              GI.getBooksInVKModule([], renderPromise, m).includes(bk.code),
            );
          if (ml.length) ilModuleOptions[i] = ml;
        }
      }
    });

    // Hide, disable or enable each panel's interlinear (ORIG) tab:
    // The interlinear tab is hidden if the panel has no ilModuleOption
    //   (see logic above). Otherwise:
    // It is visible and disabled if selected module/bookGroup does
    //   not support ilModuleOption.
    // It is visible and active if ilModule is set to an ilModuleOption.
    // It is visible but inactive otherwise.
    const ilModules = ilModules0.slice();
    panels.forEach((panel, i) => {
      ilModules[i] = ''; // visible and inactive (or hidden if no ilModuleOption)
      let ilpref = ilModules0[i];
      if (ilpref === 'disabled') ilpref = null;
      if (
        panelHasILOptions[i] &&
        (!ilModuleOptions[i] || (panel && G.Tab[panel].type !== C.BIBLE))
      ) {
        ilModules[i] = 'disabled'; // visible and disabled
      } else if (
        ilpref &&
        ilModuleOptions[i][0] &&
        ilModuleOptions[i].includes(ilpref)
      ) {
        ilModules[i] = ilpref; // visible and active
      }
    });

    const panelWidths = getPanelWidths({ panels, ilModules, isPinned });

    // The tabs and panels props are used to determine how many banks of tabs
    // will be shown, which tabs are in each bank and how wide the bank is,
    // as well as how many panels will be shown and how wide the panel is.
    // - tabs: (string[] | null)[]
    // Where string[] is a tab bank, and null tab banks are not drawn.
    // - panels: (string | null)[]
    // Where string is a panel's selected module, and null panels are not drawn.
    // These two props work together as follows:
    // - The length of the panels array determines the possible number of panels.
    // - Panels which are null or undefined will not be rendered, and neither will
    //   the tab bank sharing the same index (whether the tab bank is null or not).
    // - A panel with a null tab bank will not be shown IF a previous panel has
    //   width, because the previous panel's width will be increased by an
    //   additional column. The previous panel's tab bank width will also grow
    //   accordingly.
    const tabWidths: Array<number | null> = panels.map((panel, i) => {
      let r: number | null = tabs[i] ? 1 : 0;
      if (!panel && panel !== '') r = null;
      return r;
    });
    if (tabs.length) {
      for (let i = panels.length - 1; i >= 0; i -= 1) {
        if ((panels[i] || panels[i] === '') && !tabs[i] && i > 0) {
          let ut = i - 1;
          let numPanels = 1;
          while (ut > -1 && (!panelWidths[ut] || !tabWidths[ut])) {
            if (panelWidths[ut] !== null) {
              numPanels += 1;
              tabWidths[ut] = 0;
              panelWidths[ut] = 0;
            }
            ut -= 1;
          }
          if (ut > -1) {
            panelWidths[i] = 0;
            tabWidths[ut] = 1 + numPanels;
            panelWidths[ut] = 1 + numPanels;
          }
          i = ut;
        }
      }
    }

    // Some wide panels will be rendered in multiple columns, making them
    // easier to read. Dictionary modules do not support multi-columm layout,
    // and interlinear display is better without it.
    const columns = panelWidths.map((c, i) => {
      const panel = panels[i];
      const type = panel ? G.Tab[panel].type : null;
      const ilActive =
        !!ilModuleOptions[i][0] &&
        !!ilModules[i] &&
        ilModules[i] !== 'disabled';
      return ilActive || type === C.DICTIONARY ? 1 : c;
    });

    // Each text's book/chapter/verse must be according to location v11n.
    const locs: LocationVKType[] = [];
    if (location) {
      const { book, chapter, verse: vs, v11n } = location;
      panels.forEach((panel) => {
        const tov11n = panel && G.Tab[panel].v11n;
        // Verse is inconsequential when scroll is null, so then keep
        // verse at 1 to prevent unnecessary Atext render cycles.
        const verse = (scroll && vs) || 1;
        locs.push(
          verseKey({ book, chapter, verse, v11n }, renderPromise).location(
            tov11n || undefined,
          ),
        );
      });
    }

    const numPanels = panels.filter((m) => m || m === '').length;

    const chooser = panels
      .filter((m, i) => m && panelWidths[i] && columns[i])
      .some((m) => m && G.Tab[m].type === C.GENBOOK)
      ? 'genbook'
      : 'bible';

    const showingChooser =
      showChooser ||
      (ownWindow && Build.isElectronApp && chooser === 'genbook');

    const chooserV11n =
      panels.reduce(
        (p, c) => p || (c && c in G.Tab && G.Tab[c].v11n) || null,
        null,
      ) || 'KJV';

    const bookGroups = C.SupportedBookGroups.filter(
      (bg) =>
        ['ot', 'nt'].includes(bg) ||
        panels.some(
          (p) =>
            p &&
            GI.getBooksInVKModule([], renderPromise, p).some(
              (bk) => Book[bk].bookGroup === bg,
            ),
        ),
    );

    const style = Build.isElectronApp
      ? {
          style: {
            minWidth: `${(showingChooser ? 300 : 0) + C.UI.Viewport.minPanelWidth * numPanels}px`,
          },
        }
      : {};

    let cls = '';
    if (ownWindow) cls += ' ownWindow';

    const tabBankElements = panels.map((_p: string | null, i: number) => {
      const tabWidth = tabWidths[i];
      if (tabWidth) {
        const width = `${100 * (tabWidth / numPanels)}%`;
        const tabsi = tabs[i];
        // Tabs key does not need to change after external resizing (because
        // that is handled by a resizeObserver). However, anything that changes
        // the number or width of tabs must be in this key, so that Tabs will be
        // redrawn correctly.
        const key = stringHash([
          i,
          isPinned,
          tabcntl,
          tabsi?.join(),
          mtModules[i],
          ilModules[i],
          ilModuleOptions[i],
        ]);
        if (!tabsi) return <Hbox key={key} style={{ width }} />;
        return (
          <Tabs
            key={key}
            style={{ width }}
            panelIndex={i}
            isPinned={isPinned[i]}
            module={panels[i]}
            tabs={tabsi}
            tabcntl={tabcntl}
            ilModule={ilModules[i]}
            ilModuleOption={ilModuleOptions[i]}
            mtModule={mtModules[i]}
            xulswordState={xulswordStateHandler}
          />
        );
      }
      return null;
    });

    const panelElements = panels.map((panel: string | null, i: number) => {
      const panelWidth = panelWidths[i];
      const column = columns[i];
      if (panelWidth && column && (panel || panel === '')) {
        return (
          <Atext
            key={[i, reset].join('.')}
            style={{
              flexGrow: `${panelWidths[i]}`,
              flexShrink: `${numPanels - panelWidth}`,
            }}
            panelIndex={i}
            location={locs[i]}
            selection={selection}
            module={panels[i]}
            modkey={keys[i]}
            ilModule={ilModules[i]}
            ilModuleOption={ilModuleOptions[i]}
            columns={column}
            show={show}
            place={place}
            scroll={scroll}
            isPinned={isPinned[i]}
            noteBoxHeight={noteBoxHeight[i]}
            maximizeNoteBox={maximizeNoteBox[i]}
            ownWindow={ownWindow}
            onAudioClick={audioHandler}
            bbDragEnd={bbDragEnd}
            xulswordState={xulswordStateHandler}
            onWheel={(e: SyntheticEvent) => {
              eHandler(e);
              this.popupParentHandler(e, panel);
            }}
            onMouseOut={(e: SyntheticEvent) => {
              this.popupParentHandler(e, panel);
            }}
            onMouseOver={(e: SyntheticEvent) => {
              this.popupParentHandler(e, panel);
            }}
            onMouseMove={(e: SyntheticEvent) => {
              this.popupParentHandler(e, panel);
            }}
            ref={atextRefs[i]}
          />
        );
      }
      return null;
    });

    log.silly('viewport state: ', state);

    return (
      <Hbox
        domref={loadingRef}
        {...addClass(`viewport ${cls} bp6-focus-disabled`, props)}
        {...style}
        {...topHandle('onClick', eHandler)}
      >
        {chooser === 'bible' && showingChooser && (
          <Chooser
            key={[reset, location?.book].join('.')}
            selection={location?.book || ''}
            v11n={chooserV11n}
            headingsModule={firstUnpinnedBible}
            bookGroups={bookGroups}
            availableBooks={availableBooks}
            onCloseChooserClick={eHandler}
            onAudioClick={audioHandler}
          />
        )}
        {chooser === 'genbook' && showingChooser && (
          <GenbookChooser
            key={reset}
            panels={panels}
            keys={keys}
            xulswordStateHandler={xulswordStateHandler}
            onAudioClick={audioHandler}
          />
        )}

        <Vbox
          className={[
            'textarea',
            tabBankElements.filter(Boolean).length > 1
              ? 'multi-panel'
              : 'single-panel',
          ].join(' ')}
          flex="1"
          onKeyDown={eHandler}
        >
          <div className="tabrow">{tabBankElements}</div>

          <Hbox className="textrow userFontBase" flex="1">
            {popupParent &&
              elemdata?.length &&
              ReactDOM.createPortal(
                <Popup
                  className="hide"
                  key={[gap, elemdata.length, popupReset].join('.')}
                  elemdata={elemdata}
                  gap={gap}
                  onMouseMove={popupHandler}
                  onPopupClick={popupHandler}
                  onSelectChange={popupHandler}
                  onMouseLeftPopup={popupHandler}
                  onPopupContextMenu={popupHandler}
                  ref={popupRef}
                />,
                popupParent,
              )}

            {panelElements}
          </Hbox>
        </Vbox>
      </Hbox>
    );
  }
}
Viewport.propTypes = propTypes;

export default Viewport;

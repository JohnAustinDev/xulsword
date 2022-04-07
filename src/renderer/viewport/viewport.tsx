/* eslint-disable react/no-did-update-set-state */
/* eslint-disable react/forbid-prop-types */
/* eslint-disable no-continue */
/* eslint-disable prefer-destructuring */
/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/jsx-props-no-spreading */
import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import C from '../../constant';
import { stringHash } from '../../common';
import Popup from '../popup/popup';
import {
  popupParentHandler as popupParentHandlerH,
  popupHandler as popupHandlerH,
  PopupParent,
  PopupParentState,
  PopupParentProps,
} from '../popup/popupParentH';
import G from '../rg';
import { clearPending, verseKey, jsdump } from '../rutil';
import {
  addClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  topHandle,
} from '../libxul/xul';
import { Hbox, Vbox } from '../libxul/boxes';
import Chooser from './chooser';
import Tabs from './tabs';
import Atext from './atext';
import '../libxul/xul.css';
import './viewport.css';

import type {
  LocationVKType,
  ScrollType,
  XulswordStatePref,
  NoteboxBarHandlerType,
} from '../../type';

const defaultProps = xulDefaultProps;

const propTypes = {
  ...xulPropTypes,
  location: PropTypes.object,
  selection: PropTypes.object,
  scroll: PropTypes.object,

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
  maximizeNoteBox: PropTypes.arrayOf(PropTypes.number).isRequired,
  ownWindow: PropTypes.bool.isRequired,

  eHandler: PropTypes.func.isRequired,
  noteboxBarHandler: PropTypes.func.isRequired,
  xulswordStateHandler: PropTypes.func.isRequired,
  atextRefs: PropTypes.arrayOf(PropTypes.object),
};

type ViewportProps = PopupParentProps &
  XulProps & {
    location: LocationVKType | null;
    selection: LocationVKType | null;
    scroll: ScrollType;
    keys: (string | undefined)[];
    showChooser: boolean;
    tabs: (string[] | undefined)[];
    panels: (string | null)[];
    ilModules: (string | undefined)[];
    mtModules: (string | undefined)[];
    noteBoxHeight: number[];
    maximizeNoteBox: number[];
    ownWindow: boolean;

    eHandler: (e: React.SyntheticEvent) => void;
    noteboxBarHandler: NoteboxBarHandlerType;
    xulswordStateHandler: (s: Partial<XulswordStatePref>) => void;
  };

type ViewportState = PopupParentState & {
  reset: number;
};

class Viewport extends React.Component implements PopupParent {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  popupParentHandler: (
    es: React.SyntheticEvent,
    module: string | undefined
  ) => void;

  popupHandler: (e: React.SyntheticEvent) => void;

  popupDelayTO: NodeJS.Timeout | undefined | null;

  popupUnblockTO: NodeJS.Timeout | undefined;

  constructor(props: ViewportProps) {
    super(props);

    const s: ViewportState = {
      elemhtml: [],
      eleminfo: [],
      gap: 0,
      popupHold: false,
      popupParent: null,
      popupReset: 0,
      reset: 0,
    };
    this.state = s;

    this.popupParentHandler = popupParentHandlerH.bind(this);
    this.popupHandler = popupHandlerH.bind(this);
  }

  componentDidUpdate() {
    const state = this.state as ViewportState;
    const { popupParent } = state;
    if (popupParent && !document.body.contains(popupParent)) {
      this.setState({ popupParent: null });
    }
  }

  componentWillUnmount() {
    clearPending(this, ['popupDelayTO', 'popupUnblockTO']);
  }

  render() {
    const { popupParentHandler, popupHandler } = this;
    const props = this.props as ViewportProps;
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
      noteboxBarHandler,
      xulswordStateHandler,
      atextRefs,
    } = this.props as ViewportProps;
    const { reset, elemhtml, eleminfo, gap, popupParent, popupReset } = this
      .state as ViewportState;

    const chooser = panels.some((m) => m && G.Tab[m].type === C.GENBOOK)
      ? 'genbook'
      : 'bible';

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
        G.BooksInModule[m].forEach((bk) => availableBooks.add(bk));
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
          G.FeatureModules.hebrew[0] || G.FeatureModules.greek[0]
        );
        const bk = location.book in G.Book ? G.Book[location.book] : null;
        if (bk && (bk.bookGroup === 'ot' || bk.bookGroup === 'nt')) {
          const ml =
            G.FeatureModules[bk.bookGroup === 'nt' ? 'greek' : 'hebrew'];
          if (ml.length) ilModuleOptions[i] = ml;
        }
      }
    });

    // Hide, disable or enable each panel's interlinear (ORIG) tab:
    // The interlinear tab is hidden if the panel has no ilModuleOption
    //   (see logic above). Otherwise:
    // It is visible and disabled if selected module/bookGroup does
    //   not support ilModuleOption or if ilModule is the selected module.
    // It is visible and active if ilModule is set to an ilModuleOption.
    // It is visible but inactive otherwise.
    const ilModules = ilModules0.slice();
    panels.forEach((panel, i) => {
      ilModules[i] = ''; // visible and inactive (or hidden if no ilModuleOption)
      let ilpref = ilModules0[i];
      if (ilpref === 'disabled') ilpref = undefined;
      if (
        panelHasILOptions[i] &&
        (!ilModuleOptions[i] ||
          (panel && G.Tab[panel].type !== C.BIBLE) ||
          (panel && panel === ilModuleOptions[i][0]))
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

    // Figure out the relative width of each panel due to adjacent panels
    // sharing common module and isPinned settings etc. In such case, the
    // first panel of the matching group will widen to take up the whole
    // width while the following matching panels will shrink to zero width.
    // A value of null is given for null or undefined panels.
    const panelWidths: (number | null)[] = [];
    for (let i = 0; i < panels.length; i += 1) {
      const panel = panels[i];
      panelWidths[i] = panel || panel === '' ? 1 : null;
      if (panel) {
        const key = [panel, !!ilModules[i], !!isPinned[i]].join('.');
        let f = i + 1;
        for (;;) {
          if (f === panels.length) break;
          const modulef = panels[f];
          if (
            !modulef ||
            [modulef, !!ilModules[f], !!isPinned[f]].join('.') !== key
          )
            break;
          const panelWidthsx = panelWidths as number[];
          panelWidthsx[i] += 1;
          panelWidths[f] = 0;
          f += 1;
        }
        i += f - i - 1;
      }
    }

    // The tabs and panels props are used to determine how many banks of tabs
    // will be shown, which tabs are in each bank and how wide the bank is,
    // and how many panels will be shown and how wide the panel is.
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
    const tabWidths: (number | null)[] = panels.map((panel, i) => {
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
          verseKey(
            { book, chapter, verse, v11n },
            tov11n || undefined
          ).location()
        );
      });
    }

    const numPanels = panels.filter((m) => m || m === '').length;

    const showingChooser = showChooser || chooser === 'genbook';
    const chooserV11n =
      panels.reduce(
        (p, c) => p || (c && c in G.Tab && G.Tab[c].v11n) || null,
        null
      ) || 'KJV';
    const minWidth =
      (showingChooser ? 300 : 0) + C.UI.Viewport.minPanelWidth * numPanels;
    const bookGroups = C.SupportedBookGroups.filter(
      (bg) =>
        ['ot', 'nt'].includes(bg) ||
        panels.some(
          (p) =>
            p && G.BooksInModule[p].some((bk) => G.Book[bk].bookGroup === bg)
        )
    );

    let cls = '';
    if (ownWindow) cls += ' ownWindow';

    jsdump(
      `Rendering Viewport ${JSON.stringify({
        state: this.state,
        ilModuleOptions,
        ilMods: ilModules,
      })}`
    );

    return (
      <Hbox
        {...addClass(`viewport ${cls}`, props)}
        style={{ minWidth: `${minWidth}px` }}
        {...topHandle('onClick', eHandler)}
      >
        {!ownWindow && !showChooser && chooser !== 'genbook' && (
          <button type="button" className="open-chooser" />
        )}

        {showingChooser && (
          <Chooser
            key={[reset, location?.book].join('.')}
            type={chooser}
            selection={location?.book}
            v11n={chooserV11n}
            headingsModule={firstUnpinnedBible}
            bookGroups={bookGroups}
            availableBooks={availableBooks}
            onCloseChooserClick={eHandler}
          />
        )}

        <Vbox className="textarea" flex="1" onKeyDown={eHandler}>
          <div className="tabrow">
            {panels.map((_p: string | null, i: number) => {
              const tabWidth = tabWidths[i];
              if (tabWidth) {
                const width = `${100 * (tabWidth / numPanels)}%`;
                const tabsi = tabs[i];
                const key = stringHash(
                  i,
                  reset,
                  isPinned[i],
                  tabWidth,
                  tabsi ? [...tabsi] : 'none',
                  ilModules[i],
                  mtModules[i]
                );
                if (!tabsi) return <Hbox key={key} style={{ width }} />;
                return (
                  <Tabs
                    key={key}
                    style={{ width }}
                    panelIndex={i}
                    isPinned={isPinned[i]}
                    module={panels[i]}
                    tabs={tabsi}
                    ilModule={ilModules[i]}
                    ilModuleOption={ilModuleOptions[i]}
                    mtModule={mtModules[i]}
                  />
                );
              }
              return null;
            })}
          </div>

          <Hbox className="textrow userFontBase" flex="1">
            {popupParent &&
              elemhtml &&
              elemhtml.length &&
              ReactDOM.createPortal(
                <Popup
                  key={[gap, elemhtml.length, popupReset].join('.')}
                  elemhtml={elemhtml}
                  eleminfo={eleminfo}
                  gap={gap}
                  onMouseMove={popupHandler}
                  onPopupClick={popupHandler}
                  onSelectChange={popupHandler}
                  onMouseLeftPopup={popupHandler}
                  onPopupContextMenu={popupHandler}
                />,
                popupParent
              )}

            {panels.map((panel: string | null, i: number) => {
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
                    noteboxBar={noteboxBarHandler}
                    xulswordState={xulswordStateHandler}
                    onWheel={(e) => {
                      eHandler(e);
                      popupParentHandler(e, panel);
                    }}
                    onMouseOut={(e) => popupParentHandler(e, panel)}
                    onMouseOver={(e) => popupParentHandler(e, panel)}
                    onMouseMove={(e) => popupParentHandler(e, panel)}
                    ref={atextRefs[i]}
                  />
                );
              }
              return null;
            })}
          </Hbox>
        </Vbox>
      </Hbox>
    );
  }
}
Viewport.defaultProps = defaultProps;
Viewport.propTypes = propTypes;

export default Viewport;

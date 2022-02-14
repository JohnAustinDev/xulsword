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
import Popup from '../popup/popup';
import {
  popupParentHandler as popupParentHandlerH,
  popupHandler as popupHandlerH,
  PopupParent,
  PopupParentState,
  PopupParentProps,
} from '../popup/popupParentH';
import G from '../rg';
import { convertLocation, jsdump } from '../rutil';
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

import type { V11nType } from '../../type';

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
  book: PropTypes.string.isRequired,
  chapter: PropTypes.number.isRequired,
  verse: PropTypes.number.isRequired,
  keys: PropTypes.arrayOf(PropTypes.string).isRequired,
  selection: PropTypes.string,

  show: PropTypes.object.isRequired,
  place: PropTypes.object.isRequired,

  showChooser: PropTypes.bool.isRequired,
  tabs: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)).isRequired,
  panels: PropTypes.arrayOf(PropTypes.string).isRequired,
  ilModules: PropTypes.arrayOf(PropTypes.string).isRequired,
  mtModules: PropTypes.arrayOf(PropTypes.string).isRequired,

  flagScroll: PropTypes.arrayOf(PropTypes.number).isRequired,
  isPinned: PropTypes.arrayOf(PropTypes.bool).isRequired,
  noteBoxHeight: PropTypes.arrayOf(PropTypes.number).isRequired,
  maximizeNoteBox: PropTypes.arrayOf(PropTypes.number).isRequired,

  ownWindow: PropTypes.bool.isRequired,
  windowV11n: PropTypes.string,

  parentHandler: PropTypes.func.isRequired,
};

type ViewportProps = PopupParentProps &
  XulProps & {
    book: string;
    chapter: number;
    verse: number;
    keys: (string | undefined)[];
    selection: string | undefined;
    showChooser: boolean;
    tabs: (string[] | undefined)[];
    panels: (string | null)[];
    ilModules: (string | undefined)[];
    mtModules: (string | undefined)[];
    flagScroll: number[];
    isPinned: boolean[];
    noteBoxHeight: number[];
    maximizeNoteBox: number[];
    ownWindow: boolean;
    windowV11n: V11nType | undefined;

    parentHandler: (e: any) => void;
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

  render() {
    const { popupParentHandler, popupHandler } = this;
    const props = this.props as ViewportProps;
    const {
      book,
      chapter,
      verse,
      keys,
      selection,
      show,
      place,
      tabs,
      panels,
      ilModules: ilModules0,
      mtModules,
      flagScroll,
      isPinned: isPinned0,
      noteBoxHeight,
      maximizeNoteBox,
      showChooser,
      ownWindow,
      windowV11n,
      parentHandler,
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
          return t && G.Tab[t].type === C.BIBLE;
        });
      if (panelHasBible && book) {
        panelHasILOptions[i] = Boolean(
          G.FeatureModules.hebrew[0] || G.FeatureModules.greek[0]
        );
        const bk = book in G.Book ? G.Book[book] : null;
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

    // Each text's book/chapter/verse must be according to windowV11n.
    const loc: any = [];
    panels.forEach(() => {
      loc.push(`${book}.${chapter}.${verse}.${verse}`);
    });
    panels.forEach((panel, i) => {
      const tov11n = panel && G.Tab[panel].v11n;
      if (panel && G.Tab[panel].isVerseKey && tov11n && windowV11n) {
        loc[i] = convertLocation(windowV11n, loc[i], tov11n);
      }
    });
    const locs = loc.map((li: string) => li.split('.'));

    const numPanels = panels.filter((m) => m || m === '').length;

    const showingChooser = showChooser || chooser === 'genbook';
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
        {...topHandle('onContextMenu', parentHandler)}
        {...topHandle('onClick', parentHandler)}
      >
        {!ownWindow && !showChooser && chooser !== 'genbook' && (
          <button type="button" className="open-chooser" />
        )}

        {showingChooser && (
          <Chooser
            key={[reset, book].join('.')}
            type={chooser}
            selection={book}
            headingsModule={firstUnpinnedBible}
            bookGroups={bookGroups}
            availableBooks={availableBooks}
            windowV11n={windowV11n}
            onCloseChooserClick={parentHandler}
          />
        )}

        <Vbox
          className="textarea"
          flex="1"
          onKeyDown={parentHandler}
          onWheel={parentHandler}
        >
          <div className="tabrow">
            {panels.map((_p: string | null, i: number) => {
              const tabWidth = tabWidths[i];
              if (tabWidth) {
                const width = `${Math.round(100 * (tabWidth / numPanels))}%`;
                const tabsi = tabs[i];
                const key = [
                  i,
                  reset,
                  isPinned[i],
                  tabWidth,
                  tabsi ? tabsi.toString() : 'none',
                  ilModules[i],
                  mtModules[i],
                ].join('_');
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

          <Hbox className="textrow userFontSize" flex="1">
            {popupParent &&
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
                    ownWindow={ownWindow}
                    book={locs[i][0]}
                    chapter={Number(locs[i][1])}
                    verse={Number(locs[i][2])}
                    windowV11n={windowV11n}
                    columns={column}
                    module={panels[i]}
                    ilModule={ilModules[i]}
                    ilModuleOption={ilModuleOptions[i]}
                    show={show}
                    place={place}
                    modkey={keys[i]}
                    selection={selection}
                    flagScroll={flagScroll[i]}
                    isPinned={isPinned[i]}
                    noteBoxHeight={noteBoxHeight[i]}
                    maximizeNoteBox={maximizeNoteBox[i]}
                    onMaximizeNoteBox={parentHandler}
                    onWheel={(e) => {
                      parentHandler(e);
                      popupParentHandler(e, panel);
                    }}
                    onMouseOut={(e) => popupParentHandler(e, panel)}
                    onMouseOver={(e) => popupParentHandler(e, panel)}
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

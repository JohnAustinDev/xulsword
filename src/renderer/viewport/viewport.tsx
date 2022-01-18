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
import { findBookGroup } from '../../common';
import Popup from '../popup/popup';
import {
  popupParentHandler as popupParentHandlerH,
  popupHandler as popupHandlerH,
  PopupParent,
  PopupParentState,
  PopupParentProps,
} from '../popup/popupParentH';
import G from '../rg';
import { jsdump } from '../rutil';
import {
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  delayHandler,
} from '../libxul/xul';
import { Hbox, Vbox } from '../libxul/boxes';
import Chooser from './chooser';
import Tabs from './tabs';
import Atext from './atext';
import '../libxul/xul.css';
import './viewport.css';

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
  book: PropTypes.string.isRequired,
  chapter: PropTypes.number.isRequired,
  verse: PropTypes.number.isRequired,

  tabs: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)).isRequired,
  modules: PropTypes.arrayOf(PropTypes.string).isRequired,
  ilModules: PropTypes.arrayOf(PropTypes.string).isRequired,
  mtModules: PropTypes.arrayOf(PropTypes.string).isRequired,
  keys: PropTypes.arrayOf(PropTypes.string).isRequired,

  show: PropTypes.object.isRequired,
  place: PropTypes.object.isRequired,

  selection: PropTypes.string,
  flagScroll: PropTypes.arrayOf(PropTypes.number).isRequired,
  isPinned: PropTypes.arrayOf(PropTypes.bool).isRequired,
  noteBoxHeight: PropTypes.arrayOf(PropTypes.number).isRequired,
  maximizeNoteBox: PropTypes.arrayOf(PropTypes.number).isRequired,
  showChooser: PropTypes.bool.isRequired,

  numDisplayedWindows: PropTypes.number.isRequired,
  ownWindow: PropTypes.bool.isRequired,
  versification: PropTypes.string,

  xulswordHandler: PropTypes.func.isRequired,
};

type ViewportProps = PopupParentProps &
  XulProps & {
    book: string;
    chapter: number;
    verse: number;

    tabs: string[][];
    modules: (string | undefined)[];
    ilModules: (string | undefined)[];
    mtModules: (string | undefined)[];
    keys: string[];

    selection: string | undefined;
    flagScroll: number[];
    isPinned: boolean[];
    noteBoxHeight: number[];
    maximizeNoteBox: number[];
    showChooser: boolean;

    numDisplayedWindows: number;
    ownWindow: boolean;
    versification: string | undefined;

    xulswordHandler: (e: any) => void;
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

  popupDelayTO: NodeJS.Timeout | undefined;

  delayHandlerTO: NodeJS.Timeout | undefined;

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

    window.ipc.renderer.on('perform-resets', () => {
      G.reset();
      this.setState((prevState: ViewportState) => {
        return { reset: prevState.reset + 1 };
      });
    });

    window.ipc.renderer.on(
      'resize',
      delayHandler(
        this,
        () => {
          this.setState((prevState: ViewportState) => {
            return { reset: prevState.reset + 1 };
          });
        },
        500
      )
    );
  }

  render() {
    const { popupParentHandler, popupHandler } = this;
    const props = this.props as ViewportProps;
    const {
      id,
      book,
      chapter,
      verse,
      tabs,
      modules,
      ilModules,
      mtModules,
      show,
      place,
      keys,
      selection,
      flagScroll,
      isPinned,
      noteBoxHeight,
      maximizeNoteBox,
      showChooser,
      numDisplayedWindows,
      ownWindow,
      versification,
      xulswordHandler,
    } = this.props as ViewportProps;
    const { reset, elemhtml, eleminfo, gap, popupParent, popupReset } = this
      .state as ViewportState;

    const chooser = modules.some((m) => m && G.Tab[m].type === C.GENBOOK)
      ? 'genbook'
      : 'bible';

    const firstUnpinnedBible = modules.find((m, i) => {
      return (
        i < numDisplayedWindows &&
        !ilModules[i] &&
        m &&
        !isPinned[i] &&
        G.Tab[m].type === C.BIBLE
      );
    });

    const firstUnpinnedVerseKey = modules.find((m, i) => {
      return (
        i < numDisplayedWindows && m && !isPinned[i] && G.Tab[m].isVerseKey
      );
    });

    // Get interlinear module options
    const ilModuleOptions: any = [];
    for (let x = 0; x < C.NW; x += 1) {
      ilModuleOptions.push(['']);
    }
    const windowHasILOptions = [false, false, false];
    for (let x = 0; x < numDisplayedWindows; x += 1) {
      const windowHasBible = tabs[x].some((t) => {
        return t && G.Tab[t].type === C.BIBLE;
      });
      if (windowHasBible && book) {
        windowHasILOptions[x] = Boolean(
          G.FeatureModules.hebrew[0] || G.FeatureModules.greek[0]
        );
        const bkinfo = findBookGroup(G, book);
        if (bkinfo && (bkinfo.group === 'ot' || bkinfo.group === 'nt')) {
          const ml =
            G.FeatureModules[bkinfo.group === 'nt' ? 'greek' : 'hebrew'];
          if (ml.length) ilModuleOptions[x] = ml;
        }
      }
    }

    // Hide, disable or enable interlinear (ORIG) tabs:
    // An interlinear tab is hidden if the window has no ilModuleOption
    //   (see logic above). Otherwise:
    // It is visible and disabled if selected module/bookGroup does
    //   not support ilModuleOption or if ilModule is the selected module.
    // It is visible and active if there is an ilModule and it is an
    //   ilModuleOption.
    // It is visible but inactive otherwise.
    const ilMods = ilModules.slice();
    for (let x = 0; x < numDisplayedWindows; x += 1) {
      ilMods[x] = ''; // visible and inactive (or hidden if no ilModuleOption)
      let ilpref = ilModules[x];
      if (ilpref === 'disabled') ilpref = undefined;
      const selmod = modules[x];
      if (
        windowHasILOptions &&
        (!ilModuleOptions[x] ||
          (selmod && G.Tab[selmod].type !== C.BIBLE) ||
          (selmod && selmod === ilModuleOptions[x][0]))
      ) {
        ilMods[x] = 'disabled'; // visible and disabled
      } else if (
        ilpref &&
        ilModuleOptions[x][0] &&
        ilModuleOptions[x].includes(ilpref)
      ) {
        ilMods[x] = ilpref; // visible and active
      }
    }

    // Figure out the number of columns that will be shown for each text
    // in order to fill the number of visible windows. Some module types
    // or configurations only support single column layout, like DICT.
    const columns: number[] = [];
    for (let x = 0; x < numDisplayedWindows; x += 1) {
      columns[x] = 1;
      const mod = modules[x];
      let ilActive =
        !!ilModuleOptions[x][0] && !!ilMods[x] && ilMods[x] !== 'disabled';
      if (!mod || G.Tab[mod].type === C.DICTIONARY || ilActive) continue;
      const key = `${modules[x]} ${ilActive} ${!!isPinned[x]}`;
      let f = x + 1;
      for (;;) {
        if (f === numDisplayedWindows) break;
        const module = modules[f];
        ilActive =
          !!ilModuleOptions[f][0] && !!ilMods[f] && ilMods[f] !== 'disabled';
        if (!module || key !== `${module} ${ilActive} ${!!isPinned[f]}`) break;
        columns[x] += 1;
        columns[f] = 0;
        f += 1;
      }
      x += f - x - 1;
    }

    // Pin each tab bank of multi-column texts (two or more tab
    // banks are associated with any multi-column text).
    const isPinnedTabs = isPinned;
    for (let x = 0; x < numDisplayedWindows; x += 1) {
      let c = columns[x] - 1;
      while (c) {
        isPinnedTabs[x + c] = isPinned[x];
        c -= 1;
      }
      x += columns[x] - 1;
    }

    // Each text's book/chapter/verse should apply to the main versification.
    let locs: any = [];
    for (let x = 0; x < C.NW; x += 1) {
      locs.push(`${book}.${chapter}.${verse}.${verse}`);
    }
    for (let x = 0; x < numDisplayedWindows; x += 1) {
      const m = modules[x];
      if (m && G.Tab[m].isVerseKey && versification) {
        if (G.Tab[m].v11n !== versification) {
          locs[x] = G.LibSword.convertLocation(
            versification,
            locs[x],
            G.Tab[m].v11n
          );
        }
      }
    }
    locs = locs.map((l: any) => l.split('.'));

    const tabComps: number[] = [];
    for (let x = 0; x < numDisplayedWindows; x += 1) {
      tabComps.push(x);
    }

    const textComps: number[] = [];
    for (let x = 0; x < columns.length; x += 1) {
      if (columns[x]) textComps.push(x);
    }

    const showingChooser = showChooser || chooser === 'genbook';
    const minWidth = (showingChooser ? 300 : 0) + 200 * numDisplayedWindows;

    let cls = '';
    if (ownWindow) cls += ' ownWindow';

    jsdump(
      `Rendering Viewport ${JSON.stringify({
        state: this.state,
        ilModuleOptions,
        ilMods,
      })}`
    );

    return (
      <Hbox
        {...props}
        {...xulClass(`viewport ${cls}`, props)}
        style={{ minWidth: `${minWidth}px` }}
        onClick={xulswordHandler}
      >
        {!ownWindow && !showChooser && chooser !== 'genbook' && (
          <button type="button" className="open-chooser" />
        )}

        {showingChooser && (
          <Chooser
            type={chooser}
            selection={book}
            headingsModule={firstUnpinnedBible}
            availableBooksModule={firstUnpinnedVerseKey}
            versification={versification}
            onCloseChooserClick={xulswordHandler}
          />
        )}

        <Vbox
          className={`textarea show${numDisplayedWindows}`}
          flex="1"
          onKeyDown={xulswordHandler}
          onWheel={xulswordHandler}
        >
          <div className="tabrow">
            {tabComps.map((i) => {
              return (
                <Tabs
                  key={[
                    i,
                    reset,
                    isPinned.toString(),
                    columns.toString(),
                    tabs[i].toString(),
                    ilMods[i],
                    mtModules[i],
                  ].join('_')}
                  anid={id}
                  n={Number(i + 1)}
                  columns={columns[i]}
                  isPinned={isPinnedTabs[i]}
                  module={modules[i]}
                  tabs={tabs[i]}
                  ilModule={ilMods[i]}
                  ilModuleOption={ilModuleOptions[i]}
                  mtModule={mtModules[i]}
                />
              );
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
                />,
                popupParent
              )}

            {textComps.map((i) => {
              return (
                <Atext
                  key={[i, reset].join('.')}
                  anid={id}
                  n={Number(i + 1)}
                  ownWindow={ownWindow}
                  book={locs[i][0]}
                  chapter={Number(locs[i][1])}
                  verse={Number(locs[i][2])}
                  versification={versification}
                  columns={columns[i]}
                  module={modules[i]}
                  ilModule={ilMods[i]}
                  ilModuleOption={ilModuleOptions[i]}
                  show={show}
                  place={place}
                  modkey={keys[i]}
                  selection={selection}
                  flagScroll={flagScroll[i]}
                  isPinned={isPinned[i]}
                  noteBoxHeight={noteBoxHeight[i]}
                  maximizeNoteBox={maximizeNoteBox[i]}
                  style={{
                    flexGrow: `${columns[i]}`,
                    flexShrink: `${numDisplayedWindows - columns[i]}`,
                  }}
                  onMaximizeNoteBox={xulswordHandler}
                  onMouseOut={(e) => popupParentHandler(e, modules[i])}
                  onMouseOver={(e) => popupParentHandler(e, modules[i])}
                />
              );
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

/* eslint-disable no-continue */
/* eslint-disable prefer-destructuring */
/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { PlaceType, ShowType } from '../../type';
import C from '../../constant';
import { findBookGroup } from '../../common';
import Chooser from './chooser';
import { Hbox, Vbox } from '../libxul/boxes';
import Tabs from './tabs';
import Atext from './atext';
import { jsdump } from '../rutil';
import {
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  delayHandler,
} from '../libxul/xul';
import '../libxul/xul.css';
import './viewport.css';
import G from '../rg';

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
  book: PropTypes.string.isRequired,
  chapter: PropTypes.number.isRequired,
  verse: PropTypes.number.isRequired,
  lastverse: PropTypes.number.isRequired,

  tabs: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)).isRequired,
  modules: PropTypes.arrayOf(PropTypes.string).isRequired,
  ilModules: PropTypes.arrayOf(PropTypes.string).isRequired,
  mtModules: PropTypes.arrayOf(PropTypes.string).isRequired,
  keys: PropTypes.arrayOf(PropTypes.string).isRequired,

  // eslint-disable-next-line react/forbid-prop-types
  show: PropTypes.object.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  place: PropTypes.object.isRequired,

  flagHilight: PropTypes.arrayOf(PropTypes.number).isRequired,
  flagScroll: PropTypes.arrayOf(PropTypes.number).isRequired,
  isPinned: PropTypes.arrayOf(PropTypes.bool).isRequired,
  noteBoxHeight: PropTypes.arrayOf(PropTypes.number).isRequired,
  maximizeNoteBox: PropTypes.arrayOf(PropTypes.number).isRequired,
  showChooser: PropTypes.bool.isRequired,

  numDisplayedWindows: PropTypes.number.isRequired,
  ownWindow: PropTypes.bool.isRequired,
  chooser: PropTypes.string.isRequired,
  versification: PropTypes.string,

  handler: PropTypes.func.isRequired,
};

interface ViewportProps extends XulProps {
  book: string;
  chapter: number;
  verse: number;
  lastverse: number;

  tabs: string[][];
  modules: (string | undefined)[];
  ilModules: (string | undefined)[];
  mtModules: (string | undefined)[];
  keys: string[];

  show: ShowType;
  place: PlaceType;

  flagHilight: number[];
  flagScroll: number[];
  isPinned: boolean[];
  noteBoxHeight: number[];
  maximizeNoteBox: number[];
  showChooser: boolean;

  numDisplayedWindows: number;
  ownWindow: boolean;
  chooser: string;
  versification: string | undefined;

  handler: (e: any) => void;
}

interface ViewportState {
  resize: number;
}

class Viewport extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  constructor(props: ViewportProps) {
    super(props);

    this.state = {
      resize: 0,
    };

    window.ipc.renderer.on(
      'resize',
      delayHandler(
        this,
        () => {
          this.setState((prevState: ViewportState) => {
            return { resize: prevState.resize + 1 };
          });
        },
        500
      )
    );
  }

  render() {
    jsdump(`Rendering Viewport ${JSON.stringify(this.state)}`);
    const props = this.props as ViewportProps;
    const {
      id,
      handler,
      book,
      chapter,
      verse,
      lastverse,
      chooser,
      tabs,
      modules,
      ilModules,
      mtModules,
      show,
      place,
      keys,
      flagHilight,
      flagScroll,
      isPinned,
      noteBoxHeight,
      maximizeNoteBox,
      showChooser,
      numDisplayedWindows,
      ownWindow,
      versification,
    } = this.props as ViewportProps;
    const { resize } = this.state as ViewportState;

    const firstBible = modules.find((m, i) => {
      return i < numDisplayedWindows && m && G.Tab[m].modType === C.BIBLE;
    });

    const firstBibleOrCommentary = modules.find((m, i) => {
      return (
        i < numDisplayedWindows &&
        m &&
        (G.Tab[m].modType === C.BIBLE || G.Tab[m].modType === C.COMMENTARY)
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
        return t && G.Tab[t].modType === C.BIBLE;
      });
      if (windowHasBible && book) {
        windowHasILOptions[x] =
          G.FeatureModules.hebrew[0] || G.FeatureModules.greek[0];
        const bkinfo = findBookGroup(G, book);
        if (bkinfo && (bkinfo.group === 'ot' || bkinfo.group === 'nt')) {
          const ml =
            G.FeatureModules[bkinfo.group === 'nt' ? 'greek' : 'hebrew'];
          if (ml.length) ilModuleOptions[x] = ml;
        }
      }
    }

    // Hide, disable or enable interlinear (ORIG) tabs:
    // An interlinear tab is hidden if the window has no ilModuleOption (see logic above).
    // Otherwise:
    //   It is visible and disabled if selected module/bookGroup does not support ilModuleOption or if ilModule is the selected module.
    //   It is visible and active if there is an ilModule and it is an ilModuleOption.
    //   It is visible but inactive otherwise.
    const ilMods = ilModules.slice();
    for (let x = 0; x < numDisplayedWindows; x += 1) {
      ilMods[x] = ''; // visible and inactive (or hidden if no ilModuleOption)
      let ilpref = ilModules[x];
      if (ilpref === 'disabled') ilpref = undefined;
      const selmod = modules[x];
      if (
        windowHasILOptions &&
        (!ilModuleOptions[x] ||
          (selmod && G.Tab[selmod].modType !== C.BIBLE) ||
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
    // in order to fill the number of visible windows.
    const columns: number[] = [];
    for (let x = 0; x < numDisplayedWindows; x += 1) {
      columns[x] = 1;
      const mod = modules[x];
      const modType = mod && G.Tab[mod] ? G.Tab[mod].modType : null;
      if (!modType || modType === C.DICTIONARY) continue;
      let ilActive =
        !!ilModuleOptions[x][0] && !!ilMods[x] && ilMods[x] !== 'disabled';
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

    const tabComps: number[] = [];
    for (let x = 0; x < numDisplayedWindows; x += 1) {
      tabComps.push(x);
    }

    const textComps: number[] = [];
    for (let x = 0; x < columns.length; x += 1) {
      if (columns[x]) textComps.push(x);
    }

    // Each text's book/chapter/verse should apply to the main versification.
    let locs: any = [];
    for (let x = 0; x < C.NW; x += 1) {
      locs.push(`${book}.${chapter}.${verse}`);
    }
    for (let x = 0; x < numDisplayedWindows; x += 1) {
      const m = modules[x];
      if (m && G.Tab[m].isVerseKey && versification) {
        const to = G.LibSword.getVerseSystem(m);
        if (to !== versification) {
          locs[x] = G.LibSword.convertLocation(versification, locs[x], to);
        }
      }
    }
    locs = locs.map((l: any) => l.split('.'));

    let cls = '';
    if (props.ownWindow) cls += ' ownWindow';

    return (
      <Hbox {...props} className={xulClass(`viewport ${cls}`, props)}>
        {!showChooser && chooser !== 'none' && (
          <button type="button" className="open-chooser" onClick={handler} />
        )}

        {showChooser && chooser !== 'none' && (
          <Chooser
            key={`${book}${resize}`}
            handler={handler}
            type={chooser}
            selection={book}
            headingsModule={firstBible}
            booksModule={firstBibleOrCommentary}
            versification={versification}
            onClick={handler}
          />
        )}

        <Vbox className={`textarea show${numDisplayedWindows}`} flex="1">
          <div className="tabrow">
            {tabComps.map((i) => {
              return (
                <Tabs
                  key={`${i}${resize}${tabs}${modules.toString()}${ilModuleOptions.toString()}${isPinned.toString()}`}
                  handler={handler}
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
            {textComps.map((i) => {
              return (
                <Atext
                  key={`txt_${id}${i}${resize}`}
                  handler={handler}
                  anid={id}
                  n={Number(i + 1)}
                  ownWindow={ownWindow}
                  book={locs[i][0]}
                  chapter={Number(locs[i][1])}
                  verse={Number(locs[i][2])}
                  lastverse={lastverse}
                  columns={columns[i]}
                  module={modules[i]}
                  ilModule={ilMods[i]}
                  ilModuleOption={ilModuleOptions[i]}
                  show={show}
                  place={place}
                  modkey={keys[i]}
                  flagHilight={flagHilight[i]}
                  flagScroll={flagScroll[i]}
                  isPinned={isPinned[i]}
                  noteBoxHeight={noteBoxHeight[i]}
                  maximizeNoteBox={maximizeNoteBox[i]}
                  style={{
                    flexGrow: `${columns[i]}`,
                    flexShrink: `${numDisplayedWindows - columns[i]}`,
                  }}
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

// <Notepopup id="npopup" class="userFontSize cs-Program" isWindow="false" puptype="fn" />

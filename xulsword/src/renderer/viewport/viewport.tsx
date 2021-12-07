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
import Chooser from './chooser';
import { Hbox, Vbox } from '../libxul/boxes';
import Tabs from './tabs';
import Atext from './atext';
import { getAvailableBooks, jsdump } from '../rutil';
import {
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  delayHandler,
} from '../libxul/xul';
import '../libxul/xul.css';
import './viewport.css';
import C from '../../constant';
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

  flagHilight: PropTypes.arrayOf(PropTypes.number).isRequired,
  flagScroll: PropTypes.arrayOf(PropTypes.number).isRequired,
  isPinned: PropTypes.arrayOf(PropTypes.bool).isRequired,
  noteBoxHeight: PropTypes.arrayOf(PropTypes.number).isRequired,
  maximizeNoteBox: PropTypes.arrayOf(PropTypes.number).isRequired,
  showChooser: PropTypes.bool.isRequired,

  numDisplayedWindows: PropTypes.number,
  ownWindow: PropTypes.bool,
  chooser: PropTypes.string,

  handler: PropTypes.func,
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

  flagHilight: number[];
  flagScroll: number[];
  isPinned: boolean[];
  noteBoxHeight: number[];
  maximizeNoteBox: number[];
  showChooser: boolean;

  numDisplayedWindows: number;
  ownWindow: boolean;
  chooser: string;

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
      delayHandler.call(
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
      keys,
      flagHilight,
      flagScroll,
      isPinned,
      noteBoxHeight,
      maximizeNoteBox,
      showChooser,
      numDisplayedWindows,
      ownWindow,
    } = this.props as ViewportProps;
    const { resize } = this.state as ViewportState;

    let availableBooks: any = [];
    if (modules[0]) availableBooks = getAvailableBooks(modules[0]);

    // TODO! interlinear module options depend on book, installed modules, and bible tabs.
    const ilModuleOptions = ['KJV', 'KJV', ''];

    // Figure out the number of columns that will be shown for each text
    // in order to fill the number of visible windows.
    const columns: number[] = [];
    for (let x = 0; x < numDisplayedWindows; x += 1) {
      columns[x] = 1;
      const key = `${modules[x]} ${ilModules[x]}`;
      let f = x + 1;
      let modf = modules[f];
      while (
        modf &&
        f < numDisplayedWindows &&
        G.Tab[modf].modType !== C.DICTIONARY &&
        key === `${modf} ${ilModules[f]}`
      ) {
        columns[x] += 1;
        columns[f] = 0;
        f += 1;
        modf = modules[f];
      }
      x += f - x - 1;
    }

    const tabComps: number[] = [];
    for (let x = 0; x < numDisplayedWindows; x += 1) {
      tabComps.push(x);
    }

    const textComps: number[] = [];
    for (let x = 0; x < columns.length; x += 1) {
      if (columns[x]) textComps.push(x);
    }

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
            headingsModule={modules[0]}
            versification="KJV"
            availableBooks={availableBooks}
            onClick={handler}
          />
        )}

        <Vbox className={`textarea show${numDisplayedWindows}`} flex="1">
          <div className="tabrow">
            {tabComps.map((i) => {
              return (
                <Tabs
                  key={`tbs_${id}${i}${resize}${tabs}${modules[i]}`}
                  handler={handler}
                  anid={id}
                  n={Number(i + 1)}
                  columns={columns[i]}
                  isPinned={isPinned[i]}
                  module={modules[i]}
                  tabs={tabs[i]}
                  ilModule={ilModules[i]}
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
                  book={book}
                  chapter={chapter}
                  verse={verse}
                  lastverse={lastverse}
                  columns={columns[i]}
                  module={modules[i]}
                  ilModule={ilModules[i]}
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

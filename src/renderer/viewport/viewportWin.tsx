/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/media-has-caption */
import React from 'react';
import { JSON_parse } from '../../common';
import G from '../rg';
import renderToRoot from '../rinit';
import { getStatePref, onSetWindowState, setPrefFromState } from '../rutil';
import {
  topHandle,
  xulDefaultProps,
  XulProps,
  xulPropTypes,
} from '../libxul/xul';
import { Hbox, Vbox } from '../libxul/boxes';
import Viewport from './viewport';
import viewportParentH, {
  closeMenupopups,
  updateVersification,
  vpWinNotStatePref,
} from './viewportParentH';
import '../global-htm.css';

import type { XulswordStatePref } from '../../type';
import type { MouseWheel } from './viewportParentH';

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
};

export type ViewportWinProps = XulProps;

// Read shell arguments into initial state
Object.entries(JSON_parse(window.shell.process.argv().pop())).forEach(
  (entry) => {
    const [n, value] = entry;
    const name = n as keyof typeof vpWinNotStatePref;
    const nsp: any = vpWinNotStatePref;
    nsp[name] = value;
  }
);

export type ViewportWinState = typeof vpWinNotStatePref & XulswordStatePref;

export default class ViewportWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  viewportParentHandler: any;

  mouseWheel: MouseWheel;

  lastSavedPref: { [i: string]: any };

  listener: any[][];

  constructor(props: ViewportWinProps) {
    super(props);

    if (props.id === 'xulsword') {
      const statePref = getStatePref(props.id, null, vpWinNotStatePref) as Omit<
        XulswordStatePref,
        keyof typeof vpWinNotStatePref
      >;
      const s: ViewportWinState = {
        ...statePref,
        ...vpWinNotStatePref,
      };
      this.state = s;
    } else throw Error(`ViewportWin id must be 'xulsword'`);

    this.viewportParentHandler = viewportParentH.bind(this);
    this.lastSavedPref = {};
    this.mouseWheel = { TO: 0, atext: null, count: 0 };

    this.listener = [];
  }

  componentDidMount() {
    this.listener.push(onSetWindowState(this));
    updateVersification(this);
  }

  componentDidUpdate() {
    updateVersification(this);
  }

  componentWillUnmount() {
    this.listener.forEach((entry) => {
      const [channel, listener] = entry;
      window.ipc.renderer.removeListener(channel, listener);
    });
  }

  render() {
    const state = this.state as ViewportWinState;
    const props = this.props as ViewportWinProps;
    const {
      book,
      chapter,
      verse,
      show,
      place,
      tabs,
      panels,
      ilModules,
      mtModules,
      keys,
      selection,
      flagScroll,
      isPinned,
      noteBoxHeight,
      maximizeNoteBox,
      showChooser,
      vpreset,
      windowV11n,
    } = state;
    const { id } = props;
    const { lastSavedPref: lastSetPrefs, viewportParentHandler } = this;

    if (id && setPrefFromState(id, state, lastSetPrefs, vpWinNotStatePref)) {
      G.setGlobalStateFromPref(
        null,
        ['book', 'chapter', 'verse', 'selection', 'flagScroll'].map((p) => {
          return `${id}.${p}`;
        })
      );
    }

    const short = true;
    console.log(
      `Rendering ViewportWin ${JSON.stringify({
        ...state,
        tabs: short ? 'not-printed' : tabs,
      })}`
    );

    return (
      <Vbox
        {...this.props}
        {...topHandle('onClick', () => closeMenupopups(this), this.props)}
      >
        <Hbox flex="1">
          <Viewport
            key={[vpreset, showChooser].join('.')}
            id="main-viewport"
            parentHandler={viewportParentHandler}
            book={book}
            chapter={chapter}
            verse={verse}
            tabs={tabs}
            panels={panels}
            ilModules={ilModules}
            mtModules={mtModules}
            show={show}
            place={place}
            keys={keys}
            selection={selection}
            flagScroll={flagScroll}
            isPinned={isPinned}
            noteBoxHeight={noteBoxHeight}
            maximizeNoteBox={maximizeNoteBox}
            showChooser={false}
            ownWindow
            windowV11n={windowV11n}
          />
        </Hbox>
      </Vbox>
    );
  }
}
ViewportWin.defaultProps = defaultProps;
ViewportWin.propTypes = propTypes;

renderToRoot(<ViewportWin id="xulsword" pack="start" height="100%" />);

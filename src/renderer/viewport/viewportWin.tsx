/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/media-has-caption */
import React from 'react';
import C from '../../constant';
import { trim, stringHash } from '../../common';
import G from '../rg';
import renderToRoot from '../rinit';
import {
  clearPending,
  getStatePref,
  onSetWindowState,
  windowArgument,
} from '../rutil';
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
  vpWinNotStatePref,
} from './viewportParentH';

import type { XulswordStatePref } from '../../type';
import type Atext from './atext';

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
};

export type ViewportWinProps = XulProps;

export type ViewportWinState = XulswordStatePref & typeof vpWinNotStatePref;

// Window arguments that are used to set initial state must be updated locally
// and in Prefs, so that component reset or program restart won't cause
// reversion to initial state.
let notStatePref = windowArgument('xulswordState') as typeof vpWinNotStatePref;

export default class ViewportWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  viewportParentHandler: any;

  dictkeydownTO: NodeJS.Timeout | undefined;

  wheelScrollTO: NodeJS.Timeout | undefined;

  destroy: (() => void)[];

  atextRefs: React.RefObject<Atext>[];

  constructor(props: ViewportWinProps) {
    super(props);

    if (props.id !== 'xulsword')
      throw Error(`ViewportWin id must be 'xulsword'`);
    const statePref = getStatePref(props.id, null) as Omit<
      XulswordStatePref,
      keyof typeof vpWinNotStatePref
    >;
    const s: ViewportWinState = {
      ...statePref,
      ...notStatePref,
    };
    this.state = s;

    this.viewportParentHandler = viewportParentH.bind(this);

    this.destroy = [];

    this.atextRefs = [];
    s.panels.forEach((p) => {
      this.atextRefs.push(React.createRef());
    });
  }

  componentDidMount() {
    this.destroy.push(onSetWindowState(this, vpWinNotStatePref));
  }

  componentDidUpdate(
    _prevProps: ViewportWinProps,
    prevState: ViewportWinState
  ) {
    const state = this.state as ViewportWinState;
    const { id } = this.props as ViewportWinProps;
    notStatePref = trim(state, vpWinNotStatePref);
    if (
      stringHash(notStatePref) !==
      stringHash(trim(prevState, vpWinNotStatePref))
    )
      G.Window.persist('xulswordState', notStatePref);
    if (id) {
      const newGlobalPref = trim(state, C.GlobalState.xulsword);
      if (
        stringHash(newGlobalPref) !==
        stringHash(trim(prevState, C.GlobalState.xulsword))
      ) {
        G.Prefs.mergeComplexValue(id, newGlobalPref);
      }
    }
  }

  componentWillUnmount() {
    clearPending(this, ['dictkeydownTO', 'wheelScrollTO']);
    this.destroy.forEach((func) => func());
    this.destroy = [];
  }

  render() {
    const state = this.state as ViewportWinState;
    const {
      location,
      selection,
      keys,
      ilModules,
      mtModules,
      tabs,
      panels,
      show,
      place,
      flagScroll,
      isPinned,
      noteBoxHeight,
      maximizeNoteBox,
      showChooser,
      vpreset,
    } = state;
    const { atextRefs, viewportParentHandler } = this;

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
            location={location}
            selection={selection}
            keys={keys}
            ilModules={ilModules}
            mtModules={mtModules}
            tabs={tabs}
            panels={panels}
            show={show}
            place={place}
            flagScroll={flagScroll}
            isPinned={isPinned}
            noteBoxHeight={noteBoxHeight}
            maximizeNoteBox={maximizeNoteBox}
            showChooser={false}
            ownWindow
            parentHandler={viewportParentHandler}
            atextRefs={atextRefs}
          />
        </Hbox>
      </Vbox>
    );
  }
}
ViewportWin.defaultProps = defaultProps;
ViewportWin.propTypes = propTypes;

renderToRoot(<ViewportWin id="xulsword" pack="start" height="100%" />);

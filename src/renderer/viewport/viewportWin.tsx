/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/media-has-caption */
import React from 'react';
import G from '../rg';
import renderToRoot from '../rinit';
import {
  clearPending,
  getStatePref,
  onSetWindowState,
  setPrefFromState,
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

export default class ViewportWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  viewportParentHandler: any;

  dictkeydownTO: NodeJS.Timeout | undefined;

  wheelScrollTO: NodeJS.Timeout | undefined;

  lastSavedPref: { [i: string]: any };

  destroy: (() => void)[];

  atextRefs: React.RefObject<Atext>[];

  constructor(props: ViewportWinProps) {
    super(props);

    if (props.id !== 'xulsword')
      throw Error(`ViewportWin id must be 'xulsword'`);
    const statePref = getStatePref(props.id, null, vpWinNotStatePref) as Omit<
      XulswordStatePref,
      keyof typeof vpWinNotStatePref
    >;
    const windowState = windowArgument(
      'xulswordState'
    ) as typeof vpWinNotStatePref;
    const s: ViewportWinState = {
      ...statePref,
      ...vpWinNotStatePref,
      ...windowState,
    };
    this.state = s;

    this.viewportParentHandler = viewportParentH.bind(this);
    this.lastSavedPref = {};

    this.destroy = [];

    this.atextRefs = [];
    s.panels.forEach((p) => {
      this.atextRefs.push(React.createRef());
    });
  }

  componentDidMount() {
    this.destroy.push(onSetWindowState(this));
  }

  componentWillUnmount() {
    clearPending(this, ['dictkeydownTO', 'wheelScrollTO']);
    this.destroy.forEach((func) => func());
    this.destroy = [];
  }

  render() {
    const state = this.state as ViewportWinState;
    const props = this.props as ViewportWinProps;
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
    const { id } = props;
    const { atextRefs, lastSavedPref, viewportParentHandler } = this;

    if (id && setPrefFromState(id, state, lastSavedPref, vpWinNotStatePref)) {
      G.setGlobalStateFromPref(
        null,
        ['location', 'selection', 'flagScroll'].map((p) => {
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

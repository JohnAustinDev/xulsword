/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/media-has-caption */
import React from 'react';
import Subscription from '../../subscription';
import C from '../../constant';
import { keep, diff } from '../../common';
import G from '../rg';
import renderToRoot from '../rinit';
import {
  clearPending,
  getStatePref,
  onSetWindowState,
  windowArgument,
} from '../rutil';
import log from '../log';
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
  vpWindowState,
  bbDragEnd as bbDragEndH,
  newModulesInstalled,
} from './viewportParentH';

import type { XulswordStateArgType, XulswordStatePref } from '../../type';
import type Atext from './atext';

const defaultProps = xulDefaultProps;

const propTypes = {
  ...xulPropTypes,
};

export type ViewportWinProps = XulProps;

const vpWinDefaults = {
  history: [] as any[],
  historyIndex: 0,
  vpreset: 0,
};

export type ViewportWinState = XulswordStatePref &
  typeof vpWindowState &
  typeof vpWinDefaults;

// Window arguments that are used to set initial state must be updated locally
// and in Prefs, so that component reset or program restart won't cause
// reversion to initial state.
let windowState = windowArgument('xulswordState');

export default class ViewportWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  viewportParentHandler: any;

  bbDragEnd: (e: React.MouseEvent, value: any) => void;

  dictkeydownTO: NodeJS.Timeout | undefined;

  wheelScrollTO: NodeJS.Timeout | undefined;

  destroy: (() => void)[];

  atextRefs: React.RefObject<Atext>[];

  constructor(props: ViewportWinProps) {
    super(props);

    if (props.id !== 'xulsword')
      throw Error(`ViewportWin id must be 'xulsword'`);
    const statePref = getStatePref(props.id) as Omit<
      XulswordStatePref,
      keyof typeof vpWindowState
    >;
    const s: ViewportWinState = {
      ...statePref,
      ...vpWinDefaults,
      ...windowState,
    };
    this.state = s;

    this.viewportParentHandler = viewportParentH.bind(this);
    this.bbDragEnd = bbDragEndH.bind(this);
    this.xulswordStateHandler = this.xulswordStateHandler.bind(this);

    this.destroy = [];

    this.atextRefs = [];
    s.panels.forEach((p) => {
      this.atextRefs.push(React.createRef());
    });
  }

  componentDidMount() {
    this.destroy.push(onSetWindowState(this, vpWindowState));
    this.destroy.push(
      Subscription.subscribe('modulesInstalled', newModulesInstalled.bind(this))
    );
  }

  componentDidUpdate(
    _prevProps: ViewportWinProps,
    prevState: ViewportWinState
  ) {
    const state = this.state as ViewportWinState;
    const { scroll } = state;
    if (!scroll?.skipWindowUpdate) {
      windowState = keep(state, vpWindowState);
      const changedWindowState = diff(
        keep(prevState, vpWindowState),
        windowState
      );
      if (changedWindowState) {
        if (changedWindowState.scroll?.skipLocalPanels)
          delete changedWindowState.scroll.skipLocalPanels;
        G.Window.mergeValue('xulswordState', changedWindowState);
      }
      const { id } = this.props as ViewportWinProps;
      if (id) {
        const changedStatePref = diff(
          keep(prevState, C.GlobalXulsword),
          keep(state, C.GlobalXulsword)
        );
        if (changedStatePref) {
          if (changedStatePref.scroll?.skipTextUpdate)
            delete changedStatePref.scroll.skipTextUpdate;
          G.Prefs.mergeValue(id, changedStatePref);
        }
      }
    }
  }

  componentWillUnmount() {
    clearPending(this, ['dictkeydownTO', 'wheelScrollTO']);
    this.destroy.forEach((func) => func());
    this.destroy = [];
  }

  xulswordStateHandler(s: XulswordStateArgType): void {
    this.setState(s);
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
      scroll,
      isPinned,
      noteBoxHeight,
      maximizeNoteBox,
      showChooser,
      vpreset,
    } = state;
    const {
      atextRefs,
      viewportParentHandler,
      bbDragEnd,
      xulswordStateHandler,
    } = this;

    log.debug('viewportWin state: ', state);

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
            scroll={scroll}
            isPinned={isPinned}
            noteBoxHeight={noteBoxHeight}
            maximizeNoteBox={maximizeNoteBox}
            showChooser={false}
            ownWindow
            atextRefs={atextRefs}
            eHandler={viewportParentHandler}
            bbDragEnd={bbDragEnd}
            xulswordStateHandler={xulswordStateHandler}
          />
        </Hbox>
      </Vbox>
    );
  }
}
ViewportWin.defaultProps = defaultProps;
ViewportWin.propTypes = propTypes;

renderToRoot(<ViewportWin id="xulsword" pack="start" height="100%" />);

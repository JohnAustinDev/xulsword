/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/media-has-caption */
import React from 'react';
import Subscription from '../../subscription';
import S from '../../defaultPrefs';
import { keep, diff, drop } from '../../common';
import G from '../rg';
import renderToRoot from '../renderer';
import log from '../log';
import {
  clearPending,
  getStatePref,
  registerUpdateStateFromPref,
  setStatePref,
  windowArguments,
} from '../rutil';
import {
  topHandle,
  xulDefaultProps,
  XulProps,
  xulPropTypes,
} from '../libxul/xul';
import { Hbox, Vbox } from '../libxul/boxes';
import Viewport from '../libxul/viewport/viewport';
import viewportParentH, {
  closeMenupopups,
  vpWindowState,
  bbDragEnd as bbDragEndH,
  showNewModules,
} from '../libxul/viewport/viewportParentH';

import type { XulswordStateArgType } from '../../type';
import type Atext from '../libxul/viewport/atext';

const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

export type ViewportWinProps = XulProps;

const notStatePrefDefault = {
  vpreset: 0,
};

const statePrefDefault = drop(S.prefs.xulsword, vpWindowState) as Omit<
  typeof S.prefs.xulsword,
  typeof vpWindowState[number]
>;

// Window arguments that are used to set initial state must be updated locally
// and in Prefs, so that component reset or program restart won't cause
// reversion to initial state.
let windowState = windowArguments('xulswordState') as Pick<
  typeof S.prefs.xulsword,
  typeof vpWindowState[number]
>;

let WindowTitle = '';

export type ViewportWinState = typeof statePrefDefault &
  typeof notStatePrefDefault &
  typeof windowState;

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

    const s: ViewportWinState = {
      ...getStatePref('prefs', 'xulsword', statePrefDefault),
      ...notStatePrefDefault,
      ...windowState,
    };
    this.state = s;

    this.viewportParentHandler = viewportParentH.bind(this);
    this.bbDragEnd = bbDragEndH.bind(this);
    this.xulswordStateHandler = this.xulswordStateHandler.bind(this);
    this.updateWindowTitle = this.updateWindowTitle.bind(this);

    this.destroy = [];

    this.atextRefs = [];
    s.panels.forEach(() => {
      this.atextRefs.push(React.createRef());
    });
  }

  componentDidMount() {
    this.destroy.push(
      registerUpdateStateFromPref('prefs', 'xulsword', this, statePrefDefault)
    );
    this.destroy.push(
      Subscription.subscribe.modulesInstalled(showNewModules.bind(this))
    );
    this.updateWindowTitle();
  }

  componentDidUpdate(
    _prevProps: ViewportWinProps,
    prevState: ViewportWinState
  ) {
    const state = this.state as ViewportWinState;
    const { scroll } = state;
    if (!scroll?.skipWindowUpdate) {
      setStatePref(
        'prefs',
        'xulsword',
        prevState,
        state,
        Object.keys(statePrefDefault)
      );
      windowState = keep(state, vpWindowState) as typeof windowState;
      const changedWindowState = diff(
        keep(prevState, vpWindowState),
        windowState
      );
      if (changedWindowState) {
        if (changedWindowState.scroll?.skipTextUpdate)
          delete changedWindowState.scroll.skipTextUpdate;
        G.Window.mergeValue('xulswordState', changedWindowState);
      }
    }
    this.updateWindowTitle();
  }

  componentWillUnmount() {
    clearPending(this, ['dictkeydownTO', 'wheelScrollTO']);
    this.destroy.forEach((func) => func());
    this.destroy = [];
  }

  updateWindowTitle() {
    const { panels, ilModules } = this.state as ViewportWinState;
    const i = panels.findIndex((p) => p !== null);
    const m = panels[i];
    const ilm = ilModules[i];
    let title = (m && G.Tab[m].label) || '';
    if (ilm) title += ` | ${G.Tab[ilm].label}`;
    if (title !== WindowTitle) {
      G.Window.setTitle(title);
      WindowTitle = title;
    }
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

renderToRoot(<ViewportWin pack="start" height="100%" />);

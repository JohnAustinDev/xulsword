/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/media-has-caption */
import React from 'react';
import Subscription from '../../subscription.ts';
import S from '../../defaultPrefs.ts';
import { keep, diff, drop, validateViewportModulePrefs } from '../../common.ts';
import G from '../rg.ts';
import renderToRoot from '../renderer.tsx';
import log from '../log.ts';
import {
  clearPending,
  getStatePref,
  registerUpdateStateFromPref,
  setStatePref,
  windowArguments,
} from '../rutil.ts';
import {
  topHandle,
  xulDefaultProps,
  XulProps,
  xulPropTypes,
} from '../libxul/xul.tsx';
import { Hbox, Vbox } from '../libxul/boxes.tsx';
import Viewport from '../libxul/viewport/viewport.tsx';
import viewportParentH, {
  closeMenupopups,
  vpWindowState,
  bbDragEnd as bbDragEndH,
} from '../libxul/viewport/viewportParentH.tsx';

import type { NewModulesType, XulswordStateArgType } from '../../type.ts';
import type Atext from '../libxul/viewport/atext.tsx';

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
    validateViewportModulePrefs(G.Tabs, s);
    this.state = s;

    this.viewportParentHandler = viewportParentH.bind(this);
    this.bbDragEnd = bbDragEndH.bind(this);
    this.xulswordStateHandler = this.xulswordStateHandler.bind(this);
    this.updateWindowTitle = this.updateWindowTitle.bind(this);
    this.persistState = this.persistState.bind(this);

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
      Subscription.subscribe.modulesInstalled((newmods: NewModulesType) => {
        const state = this.state as ViewportWinState;
        const whichTab = G.Viewport.sortTabsByLocale(
          newmods.modules
            .filter(
              (c) =>
                c.xsmType !== 'XSM_audio' &&
                c.module &&
                c.module in G.Tab &&
                G.Tab[c.module]
            )
            .map((c) => c.module)
        );
        this.persistState(
          state,
          G.Viewport.getModuleChange(whichTab, state, {
            maintainWidePanels: true,
            maintainPins: false,
          })
        );
        G.Viewport.setXulswordTabs({
          whichTab,
          doWhat: 'show',
          panelIndex: -1,
        });
      })
    );
    this.updateWindowTitle();
  }

  componentDidUpdate(
    _prevProps: ViewportWinProps,
    prevState: ViewportWinState
  ) {
    const state = this.state as ViewportWinState;
    this.persistState(prevState, state);
    this.updateWindowTitle();
  }

  componentWillUnmount() {
    clearPending(this, ['dictkeydownTO', 'wheelScrollTO']);
    this.destroy.forEach((func) => func());
    this.destroy = [];
  }

  persistState(prevState: ViewportWinState, state: ViewportWinState) {
    windowState = keep(state, vpWindowState) as typeof windowState;
    const { scroll } = state;
    if (!scroll?.skipWindowUpdate) {
      setStatePref(
        'prefs',
        'xulsword',
        prevState,
        state,
        Object.keys(statePrefDefault)
      );
      const newWindowState = diff(prevState, windowState);
      if (newWindowState) {
        G.Window.mergeValue('xulswordState', newWindowState);
      }
    }
    this.setState(diff(prevState, state) ?? null);
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
    const state = this.state as ViewportWinState;
    this.persistState(state, { ...state, ...s });
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

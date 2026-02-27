import React from 'react';
import Subscription from '../../../subscription.ts';
import { setXulswordTabs } from '../../../commands.ts';
import { getModuleChange, sortTabsByLocale } from '../../../viewport.ts';
import S from '../../../defaultPrefs.ts';
import {
  keep,
  diff,
  drop,
  validateViewportModulePrefs,
} from '../../../common.ts';
import { GE as G } from '../../G.ts';
import renderToRoot from '../../controller.tsx';
import RenderPromise from '../../renderPromise.ts';
import log from '../../log.ts';
import {
  clearPending,
  doUntilDone,
  getStatePref,
  registerUpdateStateFromPref,
  setStatePref,
  windowArguments,
} from '../../common.ts';
import { topHandle } from '../../components/libxul/xul.tsx';
import { Hbox, Vbox } from '../../components/libxul/boxes.tsx';
import Viewport from '../../components/viewport/viewport.tsx';
import viewportParentH, {
  closeMenupopups,
  vpWindowState,
  bbDragEnd as bbDragEndH,
} from '../../components/viewport/viewportParentH.ts';

import type { NewModulesType } from '../../../type.ts';
import type Atext from '../../components/atext/atext.tsx';
import type {
  RenderPromiseComponent,
  RenderPromiseState,
} from '../../renderPromise.ts';
import type { XulProps } from '../../components/libxul/xul.tsx';
import type { XulswordState } from '../../components/xulsword/xulsword.tsx';

export type ViewportWinProps = XulProps;

const notStatePrefDefault = {
  vpreset: 0,
};

const statePrefDefault = drop(S.prefs.xulsword, vpWindowState) as Omit<
  typeof S.prefs.xulsword,
  (typeof vpWindowState)[number]
>;

type VPWindowState = Pick<
  typeof S.prefs.xulsword,
  (typeof vpWindowState)[number]
>;
G.Window.setComplexValue(
  'xulswordState',
  windowArguments('xulswordState') as VPWindowState,
);

let WindowTitle = '';

export type ViewportWinState = typeof statePrefDefault &
  typeof notStatePrefDefault &
  VPWindowState &
  RenderPromiseState;

export default class ViewportWin
  extends React.Component<ViewportWinProps, ViewportWinState>
  implements RenderPromiseComponent
{
  viewportParentHandler: any;

  bbDragEnd: (e: PointerEvent, value: any) => void;

  dictkeydownTO: NodeJS.Timeout | undefined;

  wheelScrollTO: NodeJS.Timeout | undefined;

  destroy: Array<() => void>;

  atextRefs: Array<React.RefObject<Atext>>;

  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLDivElement>;

  constructor(props: ViewportWinProps) {
    super(props);

    const s: ViewportWinState = {
      ...getStatePref('prefs', 'xulsword', statePrefDefault),
      ...notStatePrefDefault,
      ...(G.Window.getComplexValue('xulswordState') as VPWindowState),
      renderPromiseID: 0,
    };
    validateViewportModulePrefs(s);
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

    this.loadingRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);
  }

  componentDidMount() {
    const { renderPromise } = this;
    this.destroy.push(
      registerUpdateStateFromPref('prefs', 'xulsword', this, statePrefDefault),
    );
    this.destroy.push(
      Subscription.subscribe.modulesInstalled((newmods: NewModulesType) => {
        const { state } = this;
        const whichTab = sortTabsByLocale(
          newmods.modules
            .filter(
              (c) =>
                c.xsmType !== 'XSM_audio' &&
                c.module &&
                c.module in G.Tab &&
                G.Tab[c.module],
            )
            .map((c) => c.module),
        );
        doUntilDone((rp) => {
          const xs = getModuleChange(whichTab, state, rp, {
            maintainWidePanels: true,
            maintainPins: false,
          });
          if (!rp.waiting()) {
            this.persistState(state, xs);
            setXulswordTabs(
              {
                whichTab,
                doWhat: 'show',
                panelIndex: -1,
              },
              renderPromise,
              windowArguments().id,
            );
          }
        });
      }),
    );
    this.updateWindowTitle();
    renderPromise.dispatch();
  }

  componentDidUpdate(
    _prevProps: ViewportWinProps,
    prevState: ViewportWinState,
  ) {
    const { state, renderPromise } = this;
    this.persistState(prevState, state);
    this.updateWindowTitle();
    renderPromise.dispatch();
  }

  componentWillUnmount() {
    clearPending(this, ['dictkeydownTO', 'wheelScrollTO']);
    this.destroy.forEach((func) => {
      func();
    });
    this.destroy = [];
  }

  persistState(prevState: ViewportWinState, state: ViewportWinState) {
    const windowState = keep(state, vpWindowState) as VPWindowState;
    const { scroll } = state;
    if (!scroll?.skipWindowUpdate) {
      setStatePref(
        'prefs',
        'xulsword',
        prevState,
        state,
        Object.keys(statePrefDefault),
      );
      const newWindowState = diff(prevState, windowState);
      if (newWindowState) {
        G.Window.mergeValue('xulswordState', newWindowState);
      }
    }
    this.setState(diff(prevState, state) ?? null);
  }

  updateWindowTitle() {
    const { panels, ilModules } = this.state;
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

  xulswordStateHandler(
    s: Parameters<React.Component<any, XulswordState>['setState']>[0],
  ) {
    const prevState = { ...this.state };
    const state =
      typeof s === 'function' ? s(prevState as XulswordState, {}) : prevState;
    if (state) this.persistState(prevState, { ...state, ...s });
  }

  render() {
    const {
      state,
      atextRefs,
      viewportParentHandler,
      loadingRef,
      bbDragEnd,
      xulswordStateHandler,
    } = this;
    const {
      location,
      selection,
      audio,
      keys,
      focusPanel,
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

    log.debug('viewportWin state: ', state);

    return (
      <Vbox
        domref={loadingRef}
        {...this.props}
        {...topHandle(
          'onPointerDown',
          () => {
            closeMenupopups(this);
          },
          this.props,
        )}
      >
        <Hbox flex="1">
          <Viewport
            key={[vpreset, showChooser].join('.')}
            id="main-viewport"
            location={location}
            selection={selection}
            audio={audio}
            keys={keys}
            focusPanel={focusPanel ?? -1}
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

renderToRoot(<ViewportWin pack="start" height="100%" />).catch((er) => {
  log.error(er);
});

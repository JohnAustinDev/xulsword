/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/media-has-caption */
import React from 'react';
import { render } from 'react-dom';
import { JSON_parse } from '../../common';
import i18nInit from '../i18n';
import G from '../rg';
import {
  getStatePref,
  jsdump,
  onSetWindowStates,
  setPrefFromState,
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

    onSetWindowStates(this);

    this.viewportParentHandler = viewportParentH.bind(this);
    this.lastSavedPref = {};
    this.mouseWheel = { TO: 0, atext: null, count: 0 };
  }

  componentDidMount() {
    updateVersification(this);
  }

  componentDidUpdate() {
    updateVersification(this);
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
    jsdump(
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

function loadedXUL() {
  jsdump('RUNNING loadedXUL()!');
  window.ipc.renderer.send('window', 'did-finish-render');
}

function unloadXUL() {
  jsdump('RUNNING unloadXUL()!');
}

i18nInit(['xulsword'])
  .then(() =>
    render(
      // Must have the same id as Xulsword component so that state will be shared.
      <ViewportWin id="xulsword" pack="start" height="100%" />,
      document.getElementById('root')
    )
  )
  .then(() => loadedXUL())
  .catch((e: string | Error) => jsdump(e));

// window.ipc.renderer.on('resize', () => {if (ViewPort) ViewPort.resize()});

window.ipc.renderer.on('close', () => unloadXUL());

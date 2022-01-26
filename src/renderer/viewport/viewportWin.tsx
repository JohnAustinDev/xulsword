/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/media-has-caption */
import React from 'react';
import { render } from 'react-dom';
import i18nInit from '../i18n';
import {
  getStatePref,
  jsdump,
  onSetWindowStates,
  updateGlobalState,
} from '../rutil';
import { handle, xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import { Hbox, Vbox } from '../libxul/boxes';
import Viewport from './viewport';
import xulswordHandlerH, {
  closeMenupopups,
  updateVersification,
} from './viewportParentH';
import '../global-htm.css';

import type { StateDefault } from '../../type';
import type { MouseWheel } from './viewportParentH';

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
};

export type ViewportWinProps = XulProps;

// The following state values are not stored in Prefs, but take
// default values in Xulsword constructor.
const notStatePref: any = {
  vpreset: 0,
};
Object.entries(JSON.parse(window.shell.process.argv().pop())).forEach(
  (entry) => {
    const [name, value] = entry;
    notStatePref[name] = value;
  }
);

export type ViewportWinState = typeof notStatePref & StateDefault;

export default class ViewportWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  xulswordHandler: any;

  mouseWheel: MouseWheel;

  lastSavedPref: { [i: string]: any };

  constructor(props: ViewportWinProps) {
    super(props);

    const statePref = props.id
      ? getStatePref(props.id, null, notStatePref)
      : undefined;

    this.state = {
      ...notStatePref,
      ...statePref,
    };

    onSetWindowStates(this);

    this.xulswordHandler = xulswordHandlerH.bind(this);
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
      modules,
      ilModules,
      mtModules,
      keys,
      numDisplayedWindows,
      selection,
      flagScroll,
      isPinned,
      noteBoxHeight,
      maximizeNoteBox,
      showChooser,
      vpreset,
      versification,
    } = state;
    const { id } = props;
    const { lastSavedPref: lastSetPrefs, xulswordHandler } = this;

    if (id) updateGlobalState(id, state, lastSetPrefs, notStatePref);

    jsdump(
      `Rendering ViewportWin ${JSON.stringify({
        ...state,
        tabs: 'not-printed',
      })}`
    );

    return (
      <Vbox
        {...this.props}
        {...handle('onClick', () => closeMenupopups(this), this.props)}
      >
        <Hbox flex="1">
          <Viewport
            key={[vpreset, showChooser].join('.')}
            id="main-viewport"
            xulswordHandler={xulswordHandler}
            book={book}
            chapter={chapter}
            verse={verse}
            tabs={tabs}
            modules={modules}
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
            numDisplayedWindows={numDisplayedWindows}
            ownWindow
            versification={versification}
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

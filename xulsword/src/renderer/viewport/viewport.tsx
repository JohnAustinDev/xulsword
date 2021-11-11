/* eslint-disable prefer-destructuring */
/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable prettier/prettier */

import React from 'react';
import PropTypes from 'prop-types';
import Chooser from './chooser';
import { Hbox } from '../libxul/boxes';
import { getAvailableBooks, jsdump } from '../rutil';
import {
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  delayHandler,
} from '../libxul/xul';
import viewportHandler from './handlers';
import '../libxul/xul.css';
import './viewport.css';

const defaultProps = {
  ...xulDefaultProps,
  book: undefined,
  chapter: 1,
  verse: 1,
  lastverse: 1,

  tabs: undefined,
  modules: undefined,
  keys: undefined,

  numDisplayedWindows: 1,
  ownWindow: false,

  handler: undefined,
};

const propTypes = {
  ...xulPropTypes,
  book: PropTypes.string,
  chapter: PropTypes.number,
  verse: PropTypes.number,
  lastverse: PropTypes.number,

  tabs: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)),
  modules: PropTypes.arrayOf(PropTypes.string),
  keys: PropTypes.arrayOf(PropTypes.string),

  numDisplayedWindows: PropTypes.number,
  ownWindow: PropTypes.bool,

  handler: PropTypes.func,
};

interface ViewportProps extends XulProps {
  book: string;
  chapter: number;
  verse: number;
  lastverse: number;

  tabs: string[][];
  modules: string[];
  keys: string[];

  numDisplayedWindows: number;
  ownWindow: boolean;

  handler: (e: any) => void;
}

interface ViewportState {
  showOriginal: boolean[];
  isPinned: boolean[];
  noteBoxHeight: number[];
  maximizeNoteBox: boolean[];
  showChooser: boolean;

  chooserReset: number;
}

class Viewport extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  handler: any;

  constructor(props: ViewportProps) {
    super(props);
    this.state = {
      showOriginal: [false, false, false],
      isPinned: [false, false, false],
      noteBoxHeight: [200, 200, 200], // Should scale to screen??
      maximizeNoteBox: [false, false, false],
      showChooser: true,

      chooserReset: 0,
    };

    window.ipc.renderer.on('resize', delayHandler.call(this, () => {
      this.setState((prevState: ViewportState) => {
        return { chooserReset: prevState.chooserReset + 1};
      });
    }, 500));

    this.handler = viewportHandler.bind(this);
  }

  render() {
    jsdump(`Rendering Viewport ${JSON.stringify(this.state)}`);
    const props = this.props as ViewportProps;
    const state = this.state as ViewportState;
    const { book, modules, ownWindow } = this.props as ViewportProps;
    const { showChooser, showOriginal, chooserReset } = this.state as ViewportState;

    const chooserType = 'bible'; // G.Tab[modules[0]].modType === C.GENBOOK ? 'genbook' : 'bible';
    const availableBooks = getAvailableBooks(modules[0]);
    const classes = [
      'viewport',
      !showChooser ? 'chooser-hidden' : '',
      ownWindow ? 'ownWindow' : '',
      // showOriginal && (G.Tab.ORIG_OT || G.Tab.ORIG_NT) ? 'original-language-tab' : ''
    ];

    return (
<Hbox {...props} className={xulClass(classes.filter(Boolean).join(' '), props)}>

  {!state.showChooser && !props.ownWindow &&
    <button type="button" className="open-chooser" onClick={this.handler}/>
  }

  {state.showChooser && !props.ownWindow &&
    <Chooser key={`${book}${chooserReset}`} type={chooserType} selection={book} headingsModule={modules[0]}
      versification="KJV" availableBooks={availableBooks} handler={this.handler} onClick={props.handler}/>
  }

  <Hbox flex="1"/>

</Hbox>
    );
  }
}
Viewport.defaultProps = defaultProps;
Viewport.propTypes = propTypes;

export default Viewport;

// <Notepopup id="npopup" class="userFontSize cs-Program" isWindow="false" puptype="fn" />

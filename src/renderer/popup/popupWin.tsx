/* eslint-disable react/no-unused-state */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
import React from 'react';
import { render } from 'react-dom';
import i18nInit from '../i18n';
import { jsdump } from '../rutil';
import {
  xulClass,
  xulDefaultProps,
  XulProps,
  xulPropTypes,
} from '../libxul/xul';
import { Vbox } from '../libxul/boxes';
import {
  popupHandler as popupHandlerH,
  PopupParent,
  PopupParentState,
  PopupParentProps,
} from './popupParentH';
import Popup from './popup';
import '../global-htm.css';
import '../libxul/xul.css';
import '../viewport/viewport.css';
import '../viewport/atext.css';

// Initial state arguments must be passed by the window
// opener, or the popupWin will not show anything.
const argv = window.shell.process.argv();
const eleminfoWin = JSON.parse(argv.pop());
const elemhtmlWin = JSON.parse(argv.pop());

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
};

type PopupWinProps = PopupParentProps & XulProps;

type PopupWinState = PopupParentState;

export default class PopupWin extends React.Component implements PopupParent {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  popupHandler: (e: React.SyntheticEvent) => void;

  constructor(props: PopupWinProps) {
    super(props);

    const s: PopupWinState = {
      elemhtml: elemhtmlWin || [],
      eleminfo: eleminfoWin || [],
      popupReset: 0,
    };
    this.state = s;

    this.popupHandler = popupHandlerH.bind(this);
  }

  render() {
    const { popupHandler } = this;
    const { elemhtml, eleminfo, popupReset } = this.state as PopupWinState;

    return (
      <Vbox {...this.props} {...xulClass('popupWin', this.props)}>
        <Popup
          key={[elemhtml.length, popupReset].join('.')}
          elemhtml={elemhtml}
          eleminfo={eleminfo}
          onPopupClick={popupHandler}
          onSelectChange={popupHandler}
          isWindow
        />
      </Vbox>
    );
  }
}
PopupWin.defaultProps = defaultProps;
PopupWin.propTypes = propTypes;

i18nInit(['xulsword'])
  .then(() =>
    render(<PopupWin height="100%" />, document.getElementById('root'))
  )
  .then(() => window.ipc.renderer.send('did-finish-render'))
  .catch((e: string | Error) => jsdump(e));

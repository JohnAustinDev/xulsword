/* eslint-disable react/no-unused-state */
/* eslint-disable import/no-cycle */
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
import { ViewportState } from '../viewport/viewport';
import { popupHandler } from '../viewport/viewportH';
import Popup from './popup';
import '../global-htm.css';

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

type PopupWinProps = XulProps;

type PopupWinState = Pick<ViewportState, 'elemhtml' | 'eleminfo'>;

export default class PopupWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  handler: (e: React.SyntheticEvent) => void;

  constructor(props: PopupWinProps) {
    super(props);

    this.state = {
      elemhtml: elemhtmlWin || [],
      eleminfo: eleminfoWin || [],
    };

    this.handler = popupHandler.bind(this);
  }

  render() {
    const { handler } = this;
    const { elemhtml, eleminfo } = this.state as PopupWinState;

    return (
      <Vbox {...this.props} className={xulClass('popupWin', this.props)}>
        <Popup
          elemhtml={elemhtml}
          eleminfo={eleminfo}
          onPopupClick={handler}
          onSelectChange={handler}
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
    render(
      <PopupWin pack="start" height="100%" />,
      document.getElementById('root')
    )
  )
  .then(() => window.ipc.renderer.send('did-finish-render'))
  .catch((e: string | Error) => jsdump(e));

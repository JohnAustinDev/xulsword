/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unused-state */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
import React from 'react';
import { diff } from '../../common';
import G from '../rg';
import renderToRoot from '../rinit';
import { windowArgument } from '../rutil';
import {
  addClass,
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
import '../viewport/atext.css';

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
};

type PopupWinProps = PopupParentProps & XulProps;

type PopupWinState = PopupParentState;

let windowState = windowArgument('popupState') as Partial<PopupWinState>;

export default class PopupWin extends React.Component implements PopupParent {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  popupHandler: (e: React.SyntheticEvent) => void;

  constructor(props: PopupWinProps) {
    super(props);

    const initialState: PopupWinState = {
      elemhtml: null,
      eleminfo: null,
      popupReset: 0,
    };

    this.state = {
      ...initialState,
      ...windowState,
    };

    this.popupHandler = popupHandlerH.bind(this);
  }

  componentDidUpdate(_prevProps: PopupWinProps, prevState: PopupWinState) {
    const state = this.state as PopupWinState;
    windowState = state;
    const changedState = diff(prevState, state);
    if (changedState) G.Window.mergeComplexValue('popupState', changedState);
  }

  render() {
    const { popupHandler } = this;
    const { elemhtml, eleminfo, popupReset } = this.state as PopupWinState;

    return (
      <Vbox {...addClass('popupWin', this.props)}>
        <Popup
          key={[elemhtml && elemhtml.length, popupReset].join('.')}
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

renderToRoot(<PopupWin height="100%" />);

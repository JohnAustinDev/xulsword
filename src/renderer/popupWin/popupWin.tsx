/* eslint-disable react/no-unused-state */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
import React from 'react';
import { diff } from '../../common.ts';
import G from '../rg.ts';
import RenderPromise from '../renderPromise.ts';
import renderToRoot from '../renderer.tsx';
import { windowArguments } from '../rutil.ts';
import {
  addClass,
  XulProps,
  xulPropTypes,
} from '../libxul/xul.tsx';
import { Vbox } from '../libxul/boxes.tsx';
import {
  popupHandler as popupHandlerH,
  PopupParent,
  PopupParentState,
  ViewportPopupProps,
  PopupParentInitState,
} from '../components/popup/popupParentH.ts';
import Popup from '../components/popup/popup.tsx';
import '../components/atext/atext.css';
import type { RenderPromiseState } from '../renderPromise.ts';

const propTypes = {
  ...xulPropTypes,
};

type PopupWinProps = ViewportPopupProps & XulProps;

type PopupWinState = PopupParentState & RenderPromiseState;

let windowState = windowArguments('popupState') as Partial<PopupWinState>;

export default class PopupWin extends React.Component implements PopupParent {

  static propTypes: typeof propTypes;

  popupHandler: typeof popupHandlerH;

  renderPromise: RenderPromise;

  constructor(props: PopupWinProps) {
    super(props);

    this.state = {
      ...PopupParentInitState,
      ...windowState,
      renderPromiseID: 0,
    } as PopupWinState;

    this.popupHandler = popupHandlerH.bind(this);

    this.renderPromise = new RenderPromise(this);
  }

  componentDidUpdate(_prevProps: PopupWinProps, prevState: PopupWinState) {
    const { renderPromise } = this;
    const state = this.state as PopupWinState;
    windowState = state;
    const changedState = diff(
      { ...prevState, popupParent: null },
      { ...state, popupParent: null }
    );
    if (changedState) G.Window.mergeValue('popupState', changedState);
    renderPromise.dispatch();
  }

  render() {
    const { popupHandler } = this;
    const { elemdata, popupReset } = this.state as PopupWinState;

    return (
      <Vbox {...addClass('popupWin', this.props)}>
        <Popup
          key={[elemdata && elemdata.length, popupReset].join('.')}
          elemdata={elemdata}
          onPopupClick={popupHandler}
          onSelectChange={popupHandler}
          isWindow
        />
      </Vbox>
    );
  }
}
PopupWin.propTypes = propTypes;

renderToRoot(<PopupWin height="100%" />);

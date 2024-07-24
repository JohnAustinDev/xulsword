import React from 'react';
import { diff } from '../../../common.ts';
import { G } from '../../G.ts';
import log from '../../log.ts';
import RenderPromise from '../../renderPromise.ts';
import renderToRoot from '../../controller.tsx';
import { windowArguments } from '../../common.ts';
import {
  addClass,
  type XulProps,
  xulPropTypes,
} from '../../components/libxul/xul.tsx';
import { Vbox } from '../../components/libxul/boxes.tsx';
import {
  popupHandler as popupHandlerH,
  type PopupParent,
  type PopupParentState,
  type ViewportPopupProps,
  PopupParentInitState,
} from '../../components/popup/popupParentH.ts';
import Popup from '../../components/popup/popup.tsx';
import '../../components/atext/atext.css';
import type { RenderPromiseState } from '../../renderPromise.ts';

const propTypes = {
  ...xulPropTypes,
};

type PopupWinProps = ViewportPopupProps & XulProps;

type PopupWinState = PopupParentState & RenderPromiseState;

let windowState: Partial<PopupWinState> | undefined;

export default class PopupWin extends React.Component implements PopupParent {
  static propTypes: typeof propTypes;

  popupHandler: typeof popupHandlerH;

  renderPromise: RenderPromise;

  constructor(props: PopupWinProps) {
    super(props);

    if (typeof windowState === 'undefined') {
      windowState = windowArguments('popupState') as Partial<PopupWinState>;
    }

    this.state = {
      ...PopupParentInitState,
      ...(windowArguments('popupState') as Partial<PopupWinState>),
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
      { ...state, popupParent: null },
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
          key={[elemdata?.length, popupReset].join('.')}
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

renderToRoot(<PopupWin height="100%" />).catch((er) => {
  log.error(er);
});

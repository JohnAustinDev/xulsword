import React from 'react';
import { diff } from '../../../common.ts';
import { GE as G } from '../../G.ts';
import log from '../../log.ts';
import RenderPromise from '../../renderPromise.ts';
import renderToRoot from '../../controller.tsx';
import { windowArguments } from '../../common.ts';
import { addClass } from '../../components/libxul/xul.tsx';
import { Vbox } from '../../components/libxul/boxes.tsx';
import {
  popupHandler as popupHandlerH,
  PopupParentInitState,
} from '../../components/popup/popupParentH.ts';
import Popup from '../../components/popup/popup.tsx';
import '../../components/atext/atext.css';

import type { RenderPromiseState } from '../../renderPromise.ts';
import type {
  PopupParent,
  PopupParentState,
} from '../../components/popup/popupParentH.ts';
import type { XulProps } from '../../components/libxul/xul.tsx';

type PopupWinProps = XulProps;

type PopupWinState = PopupParentState & RenderPromiseState;

let windowState: Partial<PopupWinState> | undefined;

export default class PopupWin
  extends React.Component<PopupWinProps, PopupWinState>
  implements PopupParent
{
  popupHandler: typeof popupHandlerH;

  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLDivElement>;

  constructor(props: PopupWinProps) {
    super(props);

    if (typeof windowState === 'undefined') {
      windowState = windowArguments('popupState') as Partial<PopupWinState>;
    }

    this.state = {
      ...PopupParentInitState,
      ...(windowArguments('popupState') as Partial<PopupWinState>),
      renderPromiseID: 0,
    };

    this.popupHandler = popupHandlerH.bind(this);

    this.loadingRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);
  }

  componentDidUpdate(_prevProps: PopupWinProps, prevState: PopupWinState) {
    const { state, renderPromise } = this;
    windowState = state;
    const changedState = diff(
      { ...prevState, popupParent: null },
      { ...state, popupParent: null },
    );
    if (changedState) G.Window.mergeValue('popupState', changedState);
    renderPromise.dispatch();
  }

  render() {
    const { state, loadingRef, popupHandler } = this;
    const { elemdata, popupReset } = state;

    return (
      <Vbox domref={loadingRef} {...addClass('popupWin', this.props)}>
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

renderToRoot(<PopupWin height="100%" />).catch((er) => {
  log.error(er);
});

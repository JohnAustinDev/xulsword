/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/no-cycle */
import { ofClass } from '../../common';
import Popup, { PopupState } from './popup';

export default function handler(this: Popup, e: React.MouseEvent) {
  const target = e.target as HTMLElement;
  switch (e.type) {
    case 'mousedown':
      if (ofClass(['draghandle'], target)) {
        this.setState((prevState: PopupState) => {
          const { drag } = prevState;
          if (!drag.x[0]) drag.x[0] = e.clientX;
          if (!drag.y[0]) drag.y[0] = e.clientY;
          drag.x[1] = e.clientX;
          drag.y[1] = e.clientY;
          return {
            dragging: true,
            drag,
          };
        });
        e.preventDefault();
      }
      break;

    case 'mousemove': {
      const { dragging } = this.state as PopupState;
      if (!dragging) return;
      this.setState((prevState: PopupState) => {
        const { drag } = prevState;
        drag.x[1] = e.clientX;
        drag.y[1] = e.clientY;
        return { drag };
      });
      e.preventDefault();
      break;
    }

    case 'mouseup': {
      const { dragging } = this.state as PopupState;
      if (dragging) this.setState({ dragging: false });
      break;
    }

    default:
      throw Error(`Unhandled popup event type: '${e.type}`);
  }
}

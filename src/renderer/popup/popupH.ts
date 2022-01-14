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
          if (!drag) return null;
          if (!drag.x[0]) drag.x[0] = e.clientX;
          if (!drag.y[0]) drag.y[0] = e.clientY;
          if (!drag.adjustment) drag.adjustment = 0;
          drag.x[1] = e.clientX;
          drag.y[1] = e.clientY;
          drag.dragging = true;
          return { drag };
        });
        e.preventDefault();
      }
      break;

    case 'mousemove': {
      const { drag } = this.state as PopupState;
      if (!drag || !drag.dragging) return;
      this.setState((prevState: PopupState) => {
        const { drag: ndrag } = prevState;
        if (!ndrag || !ndrag.dragging) return null;
        ndrag.x[1] = e.clientX;
        ndrag.y[1] = e.clientY;
        return { drag: ndrag };
      });
      e.preventDefault();
      break;
    }

    case 'mouseup': {
      const { drag } = this.state as PopupState;
      if (!drag || !drag.dragging) return;
      this.setState((prevState: PopupState) => {
        const { drag: ndrag } = prevState;
        if (!ndrag || !ndrag.dragging) return null;
        ndrag.dragging = false;
        return { drag: ndrag };
      });
      break;
    }

    default:
      throw Error(`Unhandled popup event type: '${e.type}`);
  }
}

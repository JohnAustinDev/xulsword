/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/no-cycle */
import G from 'renderer/rg';
import { getContextModule, ofClass } from '../../common';
import Popup, { PopupProps, PopupState } from './popup';

export default function handler(this: Popup, e: React.MouseEvent) {
  const target = e.target as HTMLElement;
  switch (e.type) {
    case 'click': {
      const targ = ofClass(
        [
          'fn',
          'sn',
          'cr',
          'sr',
          'dt',
          'dtl',
          'popupBackLink',
          'towindow',
          'npopup',
        ],
        target
      );
      if (targ === null || targ.type === 'npopup') return;
      e.preventDefault();
      e.stopPropagation();
      const elem = targ.element;
      const y2 = elem.getBoundingClientRect().y;
      const cm = getContextModule(elem);
      if (cm) elem.dataset.contextModule = cm;
      switch (targ.type) {
        case 'fn':
        case 'sn':
        case 'cr':
        case 'sr':
        case 'dt':
        case 'dtl': {
          this.setState((prevState: PopupState) => {
            const { history, y } = prevState;
            history.push(elem.outerHTML);
            y.push(y2);
            return { history, y };
          });
          break;
        }
        case 'popupBackLink': {
          this.setState((prevState: PopupState) => {
            const { history, y } = prevState;
            history.pop();
            y.pop();
            return { history, y };
          });
          break;
        }
        case 'towindow': {
          const { npopup } = this;
          const { showelem } = this.props as PopupProps;
          if (typeof showelem !== 'string') {
            const popup = npopup?.current as any;
            const box = popup?.firstChild?.firstChild;
            if (box) {
              const b = box.getBoundingClientRect();
              const options = {
                title: 'popup',
                webPreferences: {
                  additionalArguments: [
                    'popup',
                    JSON.stringify(showelem.outerHTML),
                  ],
                },
                openWithBounds: {
                  x: Math.round(b.x),
                  y: Math.round(b.y),
                  width: Math.round(b.width),
                  height: Math.round(b.height),
                },
              };
              G.openWindow('popup', options);
            }
          }
          break;
        }
        default:
      }
      break;
    }

    case 'mousedown':
      if (ofClass(['draghandle'], target)) {
        this.setState((prevState: PopupState) => {
          const { drag } = prevState;
          if (!drag.x.length) {
            drag.x.push(e.clientX);
            drag.y.push(e.clientY);
          }
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

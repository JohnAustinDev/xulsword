import React from 'react';
import './dragsizer.css';

import type { XulProps } from './xul.tsx';
import { Box } from './boxes.tsx';

export type DragSizerVal = {
  mousePos: number; // mouse position
  sizerPos: number; // sizer position (never < min or > max)
  isMinMax: boolean | null; // false = is-min, true = is-max, null or undefined = neither.
};

// NOTE: onDragStart plus either onDragging or onDragEnd must be
// implemented in order for the DragSizer to work.
type DragSizerProps = {
  min?: number;
  max?: number | null;
  shrink?: boolean; // moving in positive direction redices the stateProp value
  onDragStart: (e: PointerEvent) => number;
  onDragging?: (e: PointerEvent, value: DragSizerVal) => void;
  onDragEnd?: (e: PointerEvent, value: DragSizerVal) => void;
} & XulProps;

type DragSizerState = {
  dragging: number | null;
  startpos: number;
};

export default class DragSizer extends React.Component<
  DragSizerProps,
  DragSizerState
> {
  sizerRef: React.RefObject<HTMLDivElement>;

  listeners: Array<[string, (e: any) => void]>;

  constructor(props: DragSizerProps) {
    super(props);
    this.state = { dragging: null, startpos: 0 } as DragSizerState;

    this.sizerRef = React.createRef();

    this.onPointerDownLong = this.onPointerDownLong.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    this.listeners = [
      ['pointermove', this.onPointerMove],
      ['pointerup', this.onPointerUp],
    ];
  }

  componentDidMount() {
    const root = document.getElementById('root') as HTMLDivElement;
    if (root) {
      this.listeners.forEach((l) => {
        root.addEventListener(l[0], l[1]);
      });
    }
  }

  componentWillUnmount() {
    const root = document.getElementById('root') as HTMLDivElement;
    if (root) {
      this.listeners.forEach((l) => {
        root.removeEventListener(l[0], l[1]);
      });
    }
  }

  onPointerDownLong(e: React.PointerEvent) {
    const { onDragStart, orient } = this.props as DragSizerProps;
    const dragging = onDragStart(e.nativeEvent);
    e.preventDefault();
    e.stopPropagation();
    this.setState({
      dragging,
      startpos: orient === 'vertical' ? e.clientX : e.clientY,
    } as DragSizerState);
  }

  onPointerMove(e: PointerEvent) {
    const props = this.props as DragSizerProps;
    const { dragging } = this.state as DragSizerState;
    if (dragging !== null) {
      e.preventDefault();
      const { onDragging } = props;
      const value = this.setSizerValue(e);
      if (value) {
        if (value.sizerPos && onDragging) onDragging(e, value);
        if (value.isMinMax !== null) this.onPointerUp(e);
      }
    }
  }

  onPointerUp(e: PointerEvent) {
    const props = this.props as DragSizerProps;
    const { dragging } = this.state as DragSizerState;
    if (dragging !== null) {
      const { orient, onDragging, onDragEnd } = props;
      e.preventDefault();
      const value = this.setSizerValue(e);
      if (!onDragging) {
        const sizerElem = this.sizerRef.current as HTMLDivElement | undefined;
        if (sizerElem) {
          sizerElem.style[orient === 'vertical' ? 'right' : 'top'] = `0px`;
        }
      }
      this.setState({ dragging: null });
      if (value && onDragEnd) onDragEnd(e, value);
    }
  }

  setSizerValue(e: PointerEvent): DragSizerVal | null {
    const { dragging, startpos } = this.state as DragSizerState;
    if (dragging !== null) {
      const props = this.props as DragSizerProps;
      const { orient, shrink, max, onDragging } = props;
      let { min } = props;
      if (!min) min = 0;
      const sizerElem = this.sizerRef.current as HTMLDivElement | undefined;
      e.preventDefault();
      if (sizerElem) {
        const rtlcontext = getComputedStyle(sizerElem).direction;
        const shrink2 =
          orient === 'vertical' && rtlcontext === 'rtl' ? !shrink : shrink;
        // If onDragging is not implemented, then top will be used to move the sizer.
        const usetop = !onDragging;
        const delta =
          (orient === 'vertical' ? e.clientX : e.clientY) - startpos;
        const value = dragging + (shrink2 ? -1 * delta : delta);
        let sizer = value;
        if (sizer < min) sizer = min;
        if (max && sizer > max) sizer = max;
        let isMinMax = null;
        if (value < min - 5) isMinMax = false;
        if (max && value > max + 5) isMinMax = true;
        if (usetop) {
          sizerElem.style[orient === 'vertical' ? 'right' : 'top'] = `${
            shrink ? delta : -1 * delta
          }px`;
        }
        return { mousePos: value, sizerPos: sizer, isMinMax };
      }
    }
    return null;
  }

  render() {
    const props = this.props as DragSizerProps;
    const state = this.state as DragSizerState;
    const { sizerRef, onPointerDownLong } = this;
    const { dragging } = state;
    const { orient } = props;

    return (
      <div className={`dragsizer ${orient || 'horizontal'}`}>
        <Box
          className={(dragging && 'dragging') || ''}
          domref={sizerRef}
          onPointerDownLong={onPointerDownLong}
        />
      </div>
    );
  }
}

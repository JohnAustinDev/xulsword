/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable react/static-property-placement */
import React from 'react';
import PropTypes from 'prop-types';
import { xulDefaultProps, xulPropTypes, XulProps } from './xul';
import './dragsizer.css';

export type DragSizerVal = {
  mousePos: number; // mouse position
  sizerPos: number; // sizer position (never < min or > max)
  isMinMax: boolean | null; // false = is-min, true = is-max, null or undefined = neither.
};

const defaultProps = {
  ...xulDefaultProps,
  min: 0,
  max: null,
  shrink: false,
  lift: false,
};

// NOTE: onDragStart plus either onDragging or onDragEnd must be
// implemented in order for the DragSizer to work.
const propTypes = {
  ...xulPropTypes,
  onDragStart: PropTypes.func.isRequired,
  onDragging: PropTypes.func,
  onDragEnd: PropTypes.func,
  min: PropTypes.number,
  max: PropTypes.number,
  shrink: PropTypes.bool,
};

interface DragSizerProps extends XulProps {
  onDragStart: (e: React.MouseEvent) => number;
  onDragging?: (e: React.MouseEvent, value: DragSizerVal) => void;
  onDragEnd?: (e: React.MouseEvent, value: DragSizerVal) => void;
  min: number;
  max: number | null;
  shrink: boolean; // moving in positive direction redices the stateProp value
}

interface DragSizerState {
  dragging: number | null;
  startpos: number;
}

class DragSizer extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  sizerRef: React.RefObject<HTMLDivElement>;

  listeners: [string, (e: any) => void][];

  constructor(props: DragSizerProps) {
    super(props);
    this.state = { dragging: null, startpos: 0 } as DragSizerState;

    this.sizerRef = React.createRef();

    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);

    this.listeners = [
      ['mousemove', this.onMouseMove],
      ['mouseup', this.onMouseUp],
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

  onMouseDown(e: React.MouseEvent) {
    const { onDragStart, orient } = this.props as DragSizerProps;
    const dragging = onDragStart(e);
    e.preventDefault();
    this.setState({
      dragging,
      startpos: orient === 'vertical' ? e.clientX : e.clientY,
    } as DragSizerState);
  }

  onMouseMove(e: React.MouseEvent) {
    const props = this.props as DragSizerProps;
    const { dragging } = this.state as DragSizerState;
    if (dragging !== null) {
      e.preventDefault();
      const { onDragging } = props;
      const value = this.setSizerValue(e);
      if (value) {
        if (value.sizerPos && onDragging) onDragging(e, value);
        if (value.isMinMax !== null) this.onMouseUp(e);
      }
    }
  }

  onMouseUp(e: React.MouseEvent) {
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

  setSizerValue(e: React.MouseEvent): DragSizerVal | null {
    const { dragging, startpos } = this.state as DragSizerState;
    if (dragging !== null) {
      const props = this.props as DragSizerProps;
      const { orient, shrink, min, max, onDragging } = props;
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
    const { sizerRef, onMouseDown } = this;
    const { dragging } = state;
    const { orient } = props;

    return (
      <div className={`dragsizer ${orient || 'horizontal'}`}>
        <div
          className={(dragging && 'dragging') || ''}
          ref={sizerRef}
          onMouseDown={onMouseDown}
        />
      </div>
    );
  }
}
DragSizer.defaultProps = defaultProps;
DragSizer.propTypes = propTypes;

export default DragSizer;

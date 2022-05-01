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

const defaultProps = {
  ...xulDefaultProps,
  min: 50,
  max: 500,
  shrink: false,
  lift: false,
};

const propTypes = {
  ...xulPropTypes,
  onDragStart: PropTypes.func.isRequired,
  onDrag: PropTypes.func,
  onDragEnd: PropTypes.func,
  min: PropTypes.number,
  max: PropTypes.number,
  shrink: PropTypes.bool,
  lift: PropTypes.bool,
};

interface DragSizerProps extends XulProps {
  onDragStart: () => number;
  onDrag?: (value: number) => void;
  onDragEnd?: (value: number | null) => void;
  min: number;
  max: number;
  shrink: boolean; // moving in positive direction redices the stateProp value
  lift: boolean;
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
    const dragging = onDragStart();
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
      const { onDrag, orient, lift } = props;
      const value = this.currentValue(e);
      if (value !== null) {
        const sizer = this.sizerRef.current as HTMLDivElement | undefined;
        if (lift && sizer) {
          sizer.style[orient === 'vertical' ? 'left' : 'top'] = `${
            dragging - value
          }px`;
        }
        if (onDrag) onDrag(value);
      }
    }
  }

  onMouseUp(e: React.MouseEvent) {
    const props = this.props as DragSizerProps;
    const { dragging } = this.state as DragSizerState;
    if (dragging !== null) {
      e.preventDefault();
      const value = this.currentValue(e);
      const { lift, orient } = props;
      const sizer = this.sizerRef.current as HTMLDivElement | undefined;
      if (lift && sizer && value !== null) {
        sizer.style[orient === 'vertical' ? 'left' : 'top'] = '0px';
      }
      this.setState({ dragging: null });
      const { onDragEnd } = props;
      if (value !== null && onDragEnd) onDragEnd(value);
    }
  }

  currentValue(e: React.MouseEvent): number | null {
    const props = this.props as DragSizerProps;
    const { dragging, startpos } = this.state as DragSizerState;
    const { orient, shrink, min, max } = props;
    if (dragging !== null) {
      e.preventDefault();
      const delta = (orient === 'vertical' ? e.clientX : e.clientY) - startpos;
      const value = dragging + (shrink ? -1 * delta : delta);
      if (value >= min && value <= max) {
        return value;
      }
    }
    return null;
  }

  render() {
    const props = this.props as DragSizerProps;
    const state = this.state as DragSizerState;
    const { sizerRef, onMouseDown } = this;
    const { dragging } = state;
    const { orient, lift } = props;

    const c1 = ['dragsizer'];
    c1.push(orient === 'vertical' ? 'vertical' : 'horizontal');
    const c2 = [];
    if (dragging !== null) c2.push('dragging');
    if (lift) c2.push('lift');

    return (
      <div className={c1.join(' ')}>
        <div
          className={c2.join(' ')}
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

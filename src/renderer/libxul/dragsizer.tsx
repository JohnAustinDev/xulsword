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
};

const propTypes = {
  ...xulPropTypes,
  onDragStart: PropTypes.func.isRequired,
  onDrag: PropTypes.func.isRequired,
  min: PropTypes.number,
  max: PropTypes.number,
  shrink: PropTypes.bool,
};

interface DragSizerProps extends XulProps {
  onDragStart: () => number;
  onDrag: (value: number) => void;
  min: number;
  max: number;
  shrink: boolean; // moving in positive direction redices the stateProp value
}

interface DragSizerState {
  dragging: number | null;
  startpos: number;
}

class DragSizer extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  listeners: [string, (e: any) => void][];

  constructor(props: DragSizerProps) {
    super(props);
    this.state = { dragging: null, startpos: 0 } as DragSizerState;

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
    if (dragging !== undefined) {
      e.preventDefault();
      this.setState({
        dragging,
        startpos: orient === 'vertical' ? e.clientX : e.clientY,
      } as DragSizerState);
    }
  }

  onMouseMove(e: React.MouseEvent) {
    const props = this.props as DragSizerProps;
    const { dragging, startpos } = this.state as DragSizerState;
    const { onDrag, orient, shrink, min, max } = props;
    if (dragging !== null) {
      e.preventDefault();
      const delta = (orient === 'vertical' ? e.clientX : e.clientY) - startpos;
      const value = dragging + (shrink ? -1 * delta : delta);
      if (value >= min && value <= max) {
        onDrag(value);
      }
    }
  }

  onMouseUp() {
    this.setState({ dragging: null });
  }

  render() {
    const props = this.props as DragSizerProps;
    const state = this.state as DragSizerState;
    const { onMouseDown } = this;
    const { dragging } = state;
    const { orient } = props;

    const c = ['dragsizer'];
    c.push(orient === 'vertical' ? 'vertical' : 'horizontal');
    if (dragging !== null) c.push('dragging');

    return <div className={c.join(' ')} onMouseDown={onMouseDown} />;
  }
}
DragSizer.defaultProps = defaultProps;
DragSizer.propTypes = propTypes;

export default DragSizer;

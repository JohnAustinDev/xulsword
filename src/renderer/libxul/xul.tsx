/* eslint-disable @typescript-eslint/no-explicit-any */
import PropTypes from 'prop-types';
import React from 'react';

// Default prop values
export const xulDefaultProps = {};

// PropTypes checking for XUL attributes
export const xulPropTypes = {
  align: PropTypes.oneOf(['start', 'center', 'end', 'baseline', 'stretch']),
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.array]),
  className: PropTypes.string,
  dir: PropTypes.oneOf(['reverse']),
  flex: PropTypes.string,
  height: PropTypes.string,
  hidden: PropTypes.bool,
  id: PropTypes.string,
  lang: PropTypes.string,
  orient: PropTypes.oneOf(['horizontal', 'vertical']),
  pack: PropTypes.oneOf(['start', 'center', 'end']),
  domref: PropTypes.any,
  style: PropTypes.objectOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  ),
  width: PropTypes.string,
  title: PropTypes.string,

  onClick: PropTypes.func,
  onDoubleClick: PropTypes.func,
  onChange: PropTypes.func,
  onKeyDown: PropTypes.func,
  onKeyUp: PropTypes.func,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  onMouseDown: PropTypes.func,
  onMouseOver: PropTypes.func,
  onMouseOut: PropTypes.func,
  onMouseMove: PropTypes.func,
  onMouseUp: PropTypes.func,
  onMouseEnter: PropTypes.func,
  onMouseLeave: PropTypes.func,
  onWheel: PropTypes.func,
  onContextMenu: PropTypes.func,
};

// IDE TypeScript checking for props
export interface XulProps {
  align?: string | undefined;
  children?:
    | React.ReactNode
    | React.ReactNode[]
    | PropTypes.ReactElementLike
    | PropTypes.ReactElementLike[]
    | React.ReactPortal
    | undefined
    | null;
  className?: string | undefined;
  dir?: string | undefined;
  flex?: string | undefined;
  height?: string | undefined;
  hidden?: boolean | undefined;
  id?: string | undefined;
  lang?: string | undefined;
  orient?: string | undefined;
  pack?: string | undefined;
  domref?: React.RefObject<any> | undefined;
  style?: React.CSSProperties | undefined;
  width?: string | undefined;
  title?: string | undefined;

  onClick?: (e: React.SyntheticEvent<any>) => void;
  onDoubleClick?: (e: React.SyntheticEvent<any>) => void;
  onChange?: (e: React.ChangeEvent<any>) => void;
  onKeyDown?: (e: React.KeyboardEvent<any>) => void;
  onKeyUp?: (e: React.KeyboardEvent<any>) => void;
  onFocus?: (e: React.SyntheticEvent<any>) => void;
  onBlur?: (e: React.SyntheticEvent<any>) => void;
  onMouseDown?: (e: React.SyntheticEvent<any>) => void;
  onMouseOver?: (e: React.SyntheticEvent<any>) => void;
  onMouseOut?: (e: React.SyntheticEvent<any>) => void;
  onMouseMove?: (e: React.SyntheticEvent<any>) => void;
  onMouseUp?: (e: React.SyntheticEvent<any>) => void;
  onMouseEnter?: (e: React.SyntheticEvent<any>) => void;
  onMouseLeave?: (e: React.SyntheticEvent<any>) => void;
  onWheel?: (e: React.SyntheticEvent<any>) => void;
  onContextMenu?: (e: React.SyntheticEvent<any>) => void;
}

const events = [
  'onClick',
  'onDoubleClick',
  'onChange',
  'onKeyDown',
  'onKeyUp',
  'onFocus',
  'onBlur',
  'onMouseDown',
  'onMouseOver',
  'onMouseOut',
  'onMouseMove',
  'onMouseUp',
  'onMouseEnter',
  'onMouseLeave',
  'onWheel',
  'onContextMenu',
];
// const styles = ['width', 'height', 'flex'];
const enums = ['align', 'dir', 'orient', 'pack', 'type'];
const bools = ['checked', 'disabled', 'hidden', 'readonly'];
// const cssAttribs = styles.concat(enums).concat(bools);

// Returns props unchanged except having additional class name(s).
export const addClass = (classes: string | string[], props: any) => {
  const c = typeof classes === 'string' ? classes.split(' ') : classes;
  const cp = props.className ? props.className.split(' ') : [];
  const className = c.concat(cp).filter(Boolean).join(' ');
  const r: any = {};
  Object.entries(props).forEach((entry) => {
    if (entry[1] !== undefined) {
      [, r[entry[0]]] = entry;
    }
  });
  r.className = className;
  return r;
};

// Convert certain XUL props to a corresponding CSS style attribute.
// These props take number values with or without qualifiers
// for XUL backward compatibility.
export const xulStyle = (props: any): React.CSSProperties | undefined => {
  const s = {} as React.CSSProperties;
  // width
  if (props.width !== undefined)
    s.width = /^\d+$/.test(props.width)
      ? props.width.concat('px')
      : props.width;

  // height
  if (props.height !== undefined)
    s.height = /^\d+$/.test(props.width)
      ? props.height.concat('px')
      : props.height;

  // flex
  if (props.flex !== undefined) {
    s.flexGrow = props.flex.replace(/\D/, '');
    s.flexShrink = s.flexGrow;
  }

  return Object.keys(s).length ? s : undefined;
};

// Convert certain XUL props to corresponding CSS classes, adding any
// requested additional classes in the processes.
export const xulClass = (classes: string | string[], props: any) => {
  const c0 = [props.tooltip ? 'tooltip' : ''];
  const c1 = Array.isArray(classes) ? classes : classes.split(/\s+/);
  const c2 = props.className ? props.className.split(/\s+/) : [];
  const c3 = enums.map((c) => (props[c] ? `${c}-${props[c]}` : ''));
  const c4 = bools.map((c) =>
    props[c] && !/^false$/i.test(props[c]) ? `${c}` : ''
  );
  const set = [...new Set(c0.concat(c1, c2, c3, c4).filter(Boolean))];
  return { className: set.join(' ') };
};

// These XUL event listeners are registered on HTML elements
export const xulEvents = (props: any): XulProps => {
  const p: any = {};
  events.forEach((x) => {
    if (props[x] !== undefined) p[x] = props[x];
  });
  return p;
};

// Convert all props to corresponding HTML element attribtues.
// This must be used to pass props to all HTML elements but
// should only used on HTML elements (not on React components).
export const htmlAttribs = (className: string, props: any) => {
  if (props === null) return {};
  const r: any = {
    ...xulClass(className, props),
    ...xulEvents(props),
  };
  if (props.id) r.id = props.id;
  if (props.lang) r.lang = props.lang;
  if (props.domref) r.ref = props.domref;
  if (props.title) r.title = props.title;
  const style = {
    ...xulStyle(props),
    ...props.style,
  };
  if (Object.keys(style).length) {
    r.style = style;
  }

  Object.entries(props).forEach((entry) => {
    const [p, val] = entry;
    if (p.substring(0, 5) === 'data-') r[p] = val;
  });

  return r;
};

// Use topHandle() when a xulEvent is registered on a React component's top-
// level element. Otherwise any event of that same type registered on a
// component instance would never be called.
export const topHandle = (
  name: string,
  func?: (e: React.SyntheticEvent) => any,
  props?: any
) => {
  return {
    [name]: (e: React.SyntheticEvent) => {
      if (typeof func === 'function') func(e);
      if (
        !e.isPropagationStopped() &&
        props &&
        typeof props[name] === 'function'
      )
        props[name](e);
    },
  };
};

// Delay any function by ms milliseconds with only a
// single (most recent) instance called after the delay.
export function delayHandler(
  this: any,
  handler: (...args: any) => void | undefined,
  ms: number | string,
  nameTO: string
) {
  return (...args: any[]) => {
    clearTimeout(this[nameTO]);
    this[nameTO] = setTimeout(() => {
      handler.call(this, ...args);
    }, Number(ms) || 0);
  };
}

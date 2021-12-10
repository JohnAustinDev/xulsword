/* eslint-disable @typescript-eslint/no-explicit-any */
import PropTypes from 'prop-types';

// Default prop values
export const xulDefaultProps = {
  align: undefined,
  children: undefined,
  className: undefined,
  dir: undefined,
  flex: undefined,
  hidden: undefined,
  height: undefined,
  id: undefined,
  lang: undefined,
  orient: undefined,
  pack: undefined,
  style: undefined,
  width: undefined,

  onClick: undefined,
  onDoubleClick: undefined,
  onChange: undefined,
  onKeyDown: undefined,
  onFocus: undefined,
  onBlur: undefined,
  onMouseDown: undefined,
  onMouseOver: undefined,
  onMouseOut: undefined,
  onMouseMove: undefined,
  onMouseUp: undefined,
  onMouseLeave: undefined,
  onWheel: undefined,
};

// PropTypes checking for XUL attributes
export const xulPropTypes = {
  align: PropTypes.oneOf(['start', 'center', 'end', 'baseline', 'stretch']),
  children: PropTypes.node,
  className: PropTypes.string,
  dir: PropTypes.oneOf(['reverse']),
  flex: PropTypes.string,
  height: PropTypes.string,
  hidden: PropTypes.bool,
  id: PropTypes.string,
  lang: PropTypes.string,
  orient: PropTypes.oneOf(['horizontal', 'vertical']),
  pack: PropTypes.oneOf(['start', 'center', 'end']),
  style: PropTypes.objectOf(PropTypes.string),
  width: PropTypes.string,

  onClick: PropTypes.func,
  onDoubleClick: PropTypes.func,
  onChange: PropTypes.func,
  onKeyDown: PropTypes.func,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  onMouseDown: PropTypes.func,
  onMouseOver: PropTypes.func,
  onMouseOut: PropTypes.func,
  onMouseMove: PropTypes.func,
  onMouseUp: PropTypes.func,
  onMouseLeave: PropTypes.func,
  onWheel: PropTypes.func,
};

// IDE TypeScript checking for props
export interface XulProps {
  align?: string | undefined;
  children?:
    | React.ReactNode
    | React.ReactNode[]
    | PropTypes.ReactElementLike
    | PropTypes.ReactElementLike[]
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
  style?: React.CSSProperties | undefined;
  width?: string | undefined;

  onClick?: (e: React.SyntheticEvent<any>) => void;
  onDoubleClick?: (e: React.SyntheticEvent<any>) => void;
  onChange?: (e: React.ChangeEvent<any>) => void;
  onKeyDown?: (e: React.KeyboardEvent<any>) => void;
  onFocus?: (e: React.SyntheticEvent<any>) => void;
  onBlur?: (e: React.SyntheticEvent<any>) => void;
  onMouseDown?: (e: React.SyntheticEvent<any>) => void;
  onMouseOver?: (e: React.SyntheticEvent<any>) => void;
  onMouseOut?: (e: React.SyntheticEvent<any>) => void;
  onMouseMove?: (e: React.SyntheticEvent<any>) => void;
  onMouseUp?: (e: React.SyntheticEvent<any>) => void;
  onMouseLeave?: (e: React.SyntheticEvent<any>) => void;
  onWheel?: (e: React.SyntheticEvent<any>) => void;
}

const events = [
  'onClick',
  'onDoubleClick',
  'onChange',
  'onKeyDown',
  'onFocus',
  'onBlur',
  'onMouseDown',
  'onMouseOver',
  'onMouseOut',
  'onMouseMove',
  'onMouseUp',
  'onMouseLeave',
  'onWheel',
];
// const styles = ['width', 'height', 'flex'];
const enums = ['align', 'dir', 'orient', 'pack', 'type'];
const bools = ['checked', 'disabled', 'hidden', 'readonly'];
// const cssAttribs = styles.concat(enums).concat(bools);

// These XUL event listeners are registered on elements
export const xulEvents = (props: any): XulProps => {
  const p: any = {};
  events.forEach((x) => {
    p[x] = props[x];
  });
  return p;
};

// These XUL attributes number values (with or without qualifiers) are
// converted to a standard HTML element CSS style value.
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
    s.flexGrow = props.flex.includes('%')
      ? parseFloat(props.flex) / 100.0
      : props.flex;
    s.flexShrink = s.flexGrow;
  }

  return Object.keys(s).length ? s : undefined;
};

// XUL attribute booleans and enums are converted to CSS classes.
export const xulClass = (classes: string | string[], props: any) => {
  const c0 = [props.tooltip ? 'tooltip' : ''];
  const c1 = Array.isArray(classes) ? classes : classes.split(/\s+/);
  const c2 = props.className ? props.className.split(/\s+/) : [];
  const c3 = enums.map((c) => (props[c] ? `${c}-${props[c]}` : ''));
  const c4 = bools.map((c) =>
    props[c] && !/^false$/i.test(props[c]) ? `${c}` : ''
  );
  const set = [...new Set(c0.concat(c1, c2, c3, c4).filter(Boolean))];
  return set.join(' ');
};

export const htmlAttribs = (className: string, props: any) => {
  if (props === null) return {};
  const r: any = {
    id: props.id,
    lang: props.lang,
    className: xulClass(className, props),
    style: {
      ...xulStyle(props),
      ...props.style,
    },
    ...xulEvents(props),
  };

  Object.entries(props).forEach((entry) => {
    const [p, val] = entry;
    if (p.substring(0, 5) === 'data-') r[p] = val;
  });

  return r;
};

// Use a default if value is null
export const propd = (defVal: any, value: any) => {
  return value !== undefined ? value : defVal;
};

// Delay event handling by ms milliseconds with a single
// (most recent) event being handled after the delay.
export function delayHandler(
  caller: any,
  callback: (...args: any) => void,
  ms: number | string
) {
  return (...args: any[]) => {
    clearTimeout(caller.delayHandlerTO);
    caller.delayHandlerTO = setTimeout(() => {
      callback.call(caller, ...args);
    }, Number(ms) || 0);
  };
}

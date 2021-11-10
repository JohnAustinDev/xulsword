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
  onChange: undefined,
  onKeyDown: undefined,
  onFocus: undefined,
  onBlur: undefined,
  onMouseOver: undefined,
  onMouseOut: undefined,
  onMouseMove: undefined,
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
  onChange: PropTypes.func,
  onKeyDown: PropTypes.func,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  onMouseOver: PropTypes.func,
  onMouseOut: PropTypes.func,
  onMouseMove: PropTypes.func,
  onWheel: PropTypes.func,
};

// IDE TypeScript checking for props
export interface XulProps {
  align?: string | undefined;
  children?:
    | React.ReactNode[]
    | (PropTypes.ReactElementLike | null | false)[]
    | PropTypes.ReactElementLike
    | null
    | false;
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
  onChange?: (e: React.ChangeEvent<any>) => void;
  onKeyDown?: (e: React.KeyboardEvent<any>) => void;
  onFocus?: (e: React.SyntheticEvent<any>) => void;
  onBlur?: (e: React.SyntheticEvent<any>) => void;
  onMouseOver?: (e: React.SyntheticEvent<any>) => void;
  onMouseOut?: (e: React.SyntheticEvent<any>) => void;
  onMouseMove?: (e: React.SyntheticEvent<any>) => void;
  onWheel?: (e: React.SyntheticEvent<any>) => void;
}

const events = [
  'onClick',
  'onChange',
  'onKeyDown',
  'onFocus',
  'onBlur',
  'onMouseOver',
  'onMouseOut',
  'onMouseMove',
  'onWheel',
];
const styles = ['width', 'height', 'flex'];
const enums = ['align', 'dir', 'orient', 'pack', 'type'];
const bools = ['checked', 'disabled', 'hidden', 'readonly'];
const cssAttribs = styles.concat(enums).concat(bools);

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
  if (props.flex !== undefined)
    s.flexGrow = props.flex.includes('%')
      ? parseFloat(props.flex) / 100.0
      : props.flex;

  return Object.keys(s).length ? s : undefined;
};

// These XUL attribute booleans and enums are converted to CSS classes.
export const xulClass = (name: string, props: any) => {
  const c0 = [name.toLowerCase(), props.tooltip ? 'tooltip' : ''];
  const c1 = props.className ? props.className.split(/\s+/) : [];
  const c2 = enums.map((c) => (props[c] ? `${c}-${props[c]}` : ''));
  const c3 = bools.map((c) =>
    props[c] && !/^false$/i.test(props[c]) ? `${c}` : ''
  );
  const set = [...new Set(c0.concat(c1, c2, c3).filter(Boolean))];
  return set.join(' ');
};

export const htmlAttribs = (className: string, props: any) => {
  if (props === null) return {};
  return {
    id: props.id,
    lang: props.lang,
    className: xulClass(className, props),
    style: {
      ...xulStyle(props),
      ...props.style,
    },
    ...xulEvents(props),
  };
};

// Use a default if value is null
export const propd = (defVal: any, value: any) => {
  return value !== undefined ? value : defVal;
};

// Delay an event handler by ms milliseconds and any previously scheduled
// handler call will be cancelled if called like this:
// delayHandler.call(this, callback, ms)
export function delayHandler(
  this: any,
  callback: (...args: any) => void,
  ms: number | string
) {
  return (...args: any[]) => {
    clearTimeout(this.delayHandlerTO);
    this.delayHandlerTO = setTimeout(() => {
      callback.call(this, ...args);
    }, Number(ms) || 0);
  };
}

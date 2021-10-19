/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import Hbox from '../hbox/hbox';
import Image from '../image/image';
import Label from '../label/label';
import Tooltip from '../tooltip/tooltip';
import {
  keep,
  propd,
  xulClass,
  xulDefaultProps,
  xulPropTypes,
  xulStyle,
} from '../xul';
import '../xul.css';
import './button.css';

// XUL button
export default function Button(props) {
  const children = (
    <>
      {props.image !== null && (
        <Image className="button-icon" src={props.image} />
      )}
      {props.label !== null && (
        <Label className="button-text" value={props.label} />
      )}
    </>
  );
  let content = children;

  if (props.type === 'menu') {
    content = (
      <>
        <Hbox
          align={propd('center', props.align)}
          pack={propd('center', props.pack)}
          flex="1"
          dir={props.dir}
          orient={props.orient}
        >
          {children}
        </Hbox>
        <Image className="dropmarker-icon" />
      </>
    );
  }

  return (
    <button
      type="button"
      className={xulClass('button', props)}
      {...keep(props)}
      style={xulStyle(props)}
    >
      <Hbox
        className="button-box"
        align={propd('center', props.align)}
        pack={propd('center', props.pack)}
        flex="1"
        dir={props.dir}
        orient={props.orient}
      >
        {content}
      </Hbox>
      <Tooltip tip={props.tooltip} />
    </button>
  );
}
Button.defaultProps = {
  ...xulDefaultProps,
  checked: null,
  disabled: null,
  dlgType: null,
  image: null,
  label: null,
  tooltip: null,
  type: null,
};
Button.propTypes = {
  ...xulPropTypes,
  checked: PropTypes.bool,
  disabled: PropTypes.oneOf(['true', 'false']),
  dlgType: PropTypes.oneOf(['accept', 'cancel']),
  image: PropTypes.string,
  label: PropTypes.string,
  tooltip: PropTypes.string,
  type: PropTypes.oneOf(['button', 'menu']),
};

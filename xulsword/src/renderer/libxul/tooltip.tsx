/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import './xul.css';

// Tooltip called by other XUL elements
export default function Tooltip(props) {
  if (!props.tip || typeof props.tip !== 'string') return null;
  return <span className="tooltiptext">{props.tip}</span>;
}
Tooltip.defaultProps = { tip: null };
Tooltip.propTypes = { tip: PropTypes.string };

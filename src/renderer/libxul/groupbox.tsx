/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { keep, drop } from '../../common';
import { addClass, xulDefaultProps, xulPropTypes, XulProps } from './xul';
import Label from './label';
import Image from './image';
import './groupbox.css';
import { Box, Hbox, Vbox } from './boxes';

// XUL deck
const defaultProps = {
  ...xulDefaultProps,
  orient: 'vertical',
};

const propTypes = {
  ...xulPropTypes,
  caption: PropTypes.string,
  image: PropTypes.string,
};

type GroupboxProps = XulProps & {
  caption?: string;
  image?: string;
};

function Groupbox(props: GroupboxProps) {
  const { caption, image } = props;
  // These props should be passed to the groupbox body
  const passToBody = ['align', 'orient', 'pack'] as const;
  return (
    <Vbox {...drop(addClass('groupbox', props), passToBody)}>
      {caption && (
        <Hbox className="groupbox-title" align="start" pack="start">
          <Image className="caption-icon" src={image} />
          <Label className="caption-text" flex="1" value={caption} />
        </Hbox>
      )}
      <Box {...addClass('groupbox-body', keep(props, passToBody))} flex="1">
        {props.children}
      </Box>
    </Vbox>
  );
}
Groupbox.defaultProps = defaultProps;
Groupbox.propTypes = propTypes;

export default Groupbox;

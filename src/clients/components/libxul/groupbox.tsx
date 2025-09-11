import React from 'react';
import { keep, drop } from '../../../common.ts';
import { addClass } from './xul.tsx';
import Label from './label.tsx';
import Image from './image.tsx';
import { Box, Hbox, Vbox } from './boxes.tsx';
import './groupbox.css';

import type { XulProps } from './xul.tsx';

// XUL deck
type GroupboxProps = XulProps & {
  caption?: string;
  image?: string;
};

export default function Groupbox({
  orient = 'vertical',
  ...props
}: GroupboxProps) {
  const { caption, image } = props;
  // These props should be passed to the groupbox body
  const passToBody = ['align', 'orient', 'pack'] as const;
  return (
    <Vbox {...drop(addClass('groupbox', { orient, ...props }), passToBody)}>
      {caption && (
        <Hbox className="groupbox-title" align="start" pack="start">
          <Image className="caption-icon" src={image} />
          <Label className="caption-text" flex="1" value={caption} />
        </Hbox>
      )}
      <Box
        {...addClass('groupbox-body', keep({ orient, ...props }, passToBody))}
        flex="1"
      >
        {props.children}
      </Box>
    </Vbox>
  );
}

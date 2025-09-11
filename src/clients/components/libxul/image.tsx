import React from 'react';
import { htmlAttribs } from './xul.tsx';

import type { XulProps } from './xul.tsx';

// XUL image
type ImageProps = {
  src: string | undefined;
} & XulProps;

export default function Image(props: ImageProps) {
  return <img {...htmlAttribs('image', props)} src={props.src} alt="" />;
}

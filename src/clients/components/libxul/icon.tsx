import React from 'react';
import * as SHM from './blueprintIconsShim.ts';

import type { IconProps } from '@blueprintjs/core';

const Icon: React.FC<IconProps> = (props) => {
  const { icon } = props;
  const e = Object.entries(SHM.BlueprintIcons_20).find((e) => e[1] === icon);
  const iconP = e ? `${e[0]}Path` : undefined;
  const iconPath = iconP && iconP in SHM ? (SHM as any)[iconP] : undefined;

  return (
    <SHM.SVGIconContainer
      // 2. Explicitly target the 20px grid asset dimension
      size={20}
      iconName="open-application"
      // 3. Transparently pass downward user properties (intent, className, title, etc.)
      {...props}
    >
      {iconPath.map((pathString: string, index: number) => (
        <path key={index} d={pathString} fillRule="evenodd" />
      ))}
    </SHM.SVGIconContainer>
  );
};

export default Icon;

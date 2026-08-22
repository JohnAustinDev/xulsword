import React from 'react';
import classNames from 'classnames';
import * as Classes from '@blueprintjs/icons/lib/esm/classes.js';
import C from '../../../constant.ts';
import * as BlueprintJsIcons from './blueprintIconsShim.ts';
import * as BlueprintJsPaths from './blueprintIconPathsShim.ts';

import type { IconProps } from '@blueprintjs/core';
import type { BlueprintIcons_20Id } from '@blueprintjs/icons/lib/esm/generated/20px/blueprint-icons-20.d.ts';

// This is a single Icon component which replaces the many hundreds of
// individual BluePrint Icon components that only differ in iconName and
// IconPath. But the bigger reason for this Icon component is to enforce that
// ONLY the 20px icon paths will ever be used (and never a 16px icon path).
// These two changes remove webapp package dependencies buying a HUGE package
// size reduction.

const Icon: React.FC<IconProps> = (props) => {
  const { icon: iconIn } = props;

  const e = Object.entries(BlueprintJsIcons.BlueprintIcons_20).find(
    (e) => e[1] === iconIn,
  );
  const iconNameIn: BlueprintIcons_20Id | null = e ? e[1] : null;
  if (!iconNameIn) {
    throw new Error(`Icon has not been bundled: ${iconIn}`);
  }

  const iconPaths: string[] = e ? (BlueprintJsPaths as any)[e[0]] : [];

  const sizeIn = props?.size ?? C.UI.BluePrint.IconSize.LARGE;

  const pixelGridSize = C.UI.BluePrint.IconSize.LARGE;
  const scale = sizeIn / pixelGridSize;

  const svgIconContainerProps = {
    iconName: iconNameIn,
    ...props,
    size: sizeIn,
  };

  const {
    children,
    className,
    color,
    htmlTitle,
    iconName,
    size,
    svgProps,
    tagName = 'span',
    title,
    icon,
    ...htmlProps
  } = svgIconContainerProps;
  if (tagName !== 'span')
    throw new Error(
      `BluePrint SVGIconContainer tagName ${tagName} not implenented.`,
    );
  const viewBox = `0 0 ${size} ${size}`;
  const sharedSvgProps = {
    fill: color,
    height: size,
    role: 'img',
    viewBox,
    width: size,
    ...svgProps,
  };

  // Note: <span> and <svg> logic is from:
  // @blueprintjs/icons/lib/esm/svgIconContainer.js
  // while <path> logic is from:
  // @blueprintjs/icons/lib/esm/generated/components/*.js
  return (
    <span
      aria-hidden={title ? undefined : true}
      {...htmlProps}
      className={classNames(
        Classes.ICON,
        `${Classes.ICON}-${iconName}`,
        className,
      )}
      title={htmlTitle}
      ref={undefined}
    >
      <svg
        data-icon={iconName}
        {...sharedSvgProps}
        className={
          svgProps === null || svgProps === void 0 ? void 0 : svgProps.className
        }
      >
        {iconPaths.map((path, index) => {
          return (
            <path
              key={index}
              d={path}
              fillRule={'evenodd'}
              transform={`scale(${scale}, ${scale})`}
            />
          );
        })}
      </svg>
    </span>
  );
};

export default Icon;

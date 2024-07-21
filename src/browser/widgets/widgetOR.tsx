import React, { useState } from 'react';
import log from '../../renderer/log.ts';
import { createNodeList, getProps } from '../bcommon.ts';
import SelectOR from '../../renderer/libxul/selectOR.tsx';

import type {
  SelectORMType,
  SelectORProps,
} from '../../renderer/libxul/selectOR.tsx';
import type { WidgetORSettings } from './defaultSettings.ts';

// A React component widget for selecting from an arbitrary hierarchical
// list of options, such as a SWORD General Book table of contents.

export type WidgetORProps = {
  compid: string;
  settings: WidgetORSettings;
};

export type WidgetORState = Omit<SelectORProps, 'onSelection'>;

export default function WidgetOR(wprops: WidgetORProps): React.JSX.Element {
  const { compid, settings } = wprops;
  const { action, props, data } = settings;

  data.forEach((x) => {
    x[0] = x[0].toString();
  });
  if (Array.isArray(data)) {
    createNodeList(data, props);
  }

  const onSelectOR = (selection?: SelectORMType): void => {
    if (action && selection) {
      switch (action) {
        case 'genbk_audio_Play': {
          // A Drupal selectOR item follows its associated audio player item.
          const player = document
            .getElementById(compid)
            ?.parentElement?.previousElementSibling?.querySelector('audio') as
            | HTMLAudioElement
            | undefined;
          if (player) {
            const { keys } = selection;
            const [key] = keys;
            const da = data.find((x) => x[1] === key);
            if (da) {
              player.setAttribute('src', da[2].replace(/^base:/, ''));
              player.play().catch(() => {});
            }
          }
          break;
        }
        default: {
          log.error(`Unknown selectOR action: '${action}'`);
        }
      }
    }
  };

  const [state] = useState(() => {
    return getProps(props, {
      initialORM: { otherMod: 'genbk', keys: [] },
      nodeLists: [],
      otherMods: [],
      disabled: false,
      enableMultipleSelection: false,
      enableParentSelection: false,
    }) as WidgetORState;
  });

  return <SelectOR onSelection={onSelectOR} {...(state as WidgetORState)} />;
}

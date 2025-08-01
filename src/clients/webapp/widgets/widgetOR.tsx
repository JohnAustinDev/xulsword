/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import { findTreeNode } from '../../../common.ts';
import C from '../../../constant.ts';
import { Analytics } from '../../analytics.ts';
import log from '../../log.ts';
import { createNodeList, getProps, updateLinks } from '../common.ts';
import SelectOR from '../../components/libxul/selectOR.tsx';

import type {
  SelectORMType,
  SelectORProps,
} from '../../components/libxul/selectOR.tsx';
import type { WidgetORData } from './defaultSettings.ts';

// A React component widget for selecting from an arbitrary hierarchical
// list of options, such as a SWORD General Book table of contents.

export type WidgetORProps = {
  compid: string;
  settings: WidgetORData;
};

export type WidgetORState = Omit<SelectORProps, 'onSelection'>;

export default function WidgetOR(wprops: WidgetORProps): React.JSX.Element {
  const { compid, settings } = wprops;
  const { actions, props, data, update_url: updateUrl } = settings;

  const nodes = createNodeList(data);
  const { initialORM } = props;
  if (initialORM) {
    props.nodeLists = [
      {
        otherMod: initialORM.otherMod,
        label: 'genbk',
        labelClass: 'cs-LTR_DEFAULT',
        nodes,
      },
    ];
    if (findTreeNode(initialORM.keys[0], nodes) === undefined) {
      initialORM.keys = [nodes[0].id.toString()];
    }
  }

  const onSelectOR = (selection?: SelectORMType): void => {
    if (actions && selection) {
      const { keys } = selection;
      const [key] = keys;
      const segs = key.split(C.GBKSEP);
      const chapter = segs.pop();
      const parent = segs.join(C.GBKSEP);
      actions.forEach((action) => {
        switch (action) {
          case 'genbk_audio_Play': {
            updateAnalyticsInfo(selection);
            const comParent = document.getElementById(compid)?.parentElement;
            const player = comParent?.querySelector('audio') as
              | HTMLAudioElement
              | undefined;
            if (player) {
              const da = data[parent].find((x) => x[0] === chapter);
              if (da) {
                player.setAttribute('src', da[1].replace(/^base:/, ''));
                player.play().catch(() => {});
              }
            }
            break;
          }
          case 'update_url': {
            updateLinksOR(selection);
            break;
          }
          default: {
            log.error(`Unknown selectOR action: '${actions}'`);
          }
        }
      });
    }
  };

  const updateLinksOR = (selection: SelectORMType, isReset = false) => {
    const comParent = document.getElementById(compid)?.parentElement;
    const anchors = comParent?.querySelectorAll('.update_url a, a.update_url');
    if (anchors && updateUrl)
      (Array.from(anchors) as HTMLAnchorElement[]).forEach((anchor) => {
        updateLinks(selection, anchor, data, updateUrl, isReset);
      });
  };

  const updateAnalyticsInfo = (selection: SelectORMType) => {
    const { keys } = selection;
    const [key] = keys;
    const segs = key.split(C.GBKSEP);
    const chapter = segs.pop();
    const parent = segs.join(C.GBKSEP);
    const da = data[parent].find((x) => x[0] === chapter);
    if (da) {
      const [, , , mid] = da;
      const elem = document.getElementById(compid)?.parentElement;
      if (elem) {
        Analytics.addInfo({ mid: Number(mid) }, Analytics.topInfoElement(elem));
      }
    }
  };

  const [state] = useState(() => {
    const s = getProps(props, {
      initialORM: { otherMod: 'genbk', keys: [] },
      nodeLists: [],
      otherMods: [],
      disabled: false,
      enableMultipleSelection: false,
      enableParentSelection: false,
    }) as WidgetORState;

    updateLinksOR(s.initialORM, true);
    updateAnalyticsInfo(s.initialORM);

    return s;
  });

  return <SelectOR onSelection={onSelectOR} {...(state as WidgetORState)} />;
}

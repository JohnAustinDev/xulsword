import React from 'react';
import { Icon } from '@blueprintjs/core';
import { doUntilDone, updatedAudioSelection } from '../../common.tsx';
import { G } from '../../G.ts';
import RenderPromise from '../../renderPromise.ts';
import './audioIcon.css';

import type {
  AudioPlayerSelectionGB,
  OSISBookType,
  AudioPlayerSelectionVK,
} from '../../../type.ts';

export default function audioIcon(
  swordModule: string,
  bookOrKey: OSISBookType | string,
  chapter: number | undefined,
  audioHandler: (
    selection: AudioPlayerSelectionVK | AudioPlayerSelectionGB | null,
    e: React.SyntheticEvent,
  ) => void,
  renderPromise: RenderPromise,
): JSX.Element | null {
  if (swordModule && swordModule in G.Tab) {
    const selection =
      G.Tab[swordModule].isVerseKey
        ? {
            swordModule,
            book: bookOrKey as OSISBookType,
            chapter: chapter as number,
          }
        : {
            swordModule,
            key: bookOrKey,
          };
    const afile = updatedAudioSelection(selection, renderPromise);
    if (afile) {
      const handler = (e: React.SyntheticEvent) => {
        e.stopPropagation();
        doUntilDone((renderPromise) => {
          // AudioCode index may have changed since audioIcon parent was last
          // rendered.
          const s = updatedAudioSelection(selection, renderPromise);
          if (!renderPromise?.waiting()) audioHandler(s, e);
        });
      };
      return (
        <div className="audio-icon" onClick={handler}>
          <Icon icon="volume-up" />
        </div>
      );
    }
  }

  return null;
}

import React from 'react';
import { Icon } from '@blueprintjs/core';
import { doUntilDone, updatedAudioSelections } from '../../common.tsx';
import { G } from '../../G.ts';
import RenderPromise from '../../renderPromise.ts';
import './audioIcon.css';

import type {
  AudioPlayerSelectionGB,
  OSISBookType,
  AudioPlayerSelectionVK,
  AudioPrefType,
} from '../../../type.ts';

export default function audioIcon(
  swordModule: string,
  bookOrKey: OSISBookType | string,
  chapter: number | undefined,
  defaults: AudioPrefType['defaults'],
  audioHandler: (
    selection: AudioPlayerSelectionVK | AudioPlayerSelectionGB | null,
    e: React.SyntheticEvent,
  ) => void,
  renderPromise: RenderPromise,
): JSX.Element | null {
  if (swordModule && swordModule in G.Tab) {
    const selection = G.Tab[swordModule].isVerseKey
      ? {
          swordModule,
          book: bookOrKey as OSISBookType,
          chapter: chapter as number,
        }
      : {
          swordModule,
          key: bookOrKey,
        };
    const sels = updatedAudioSelections(selection, renderPromise);
    if (sels.length) {
      const handler = (e: React.SyntheticEvent) => {
        e.stopPropagation();
        doUntilDone((renderPromise) => {
          // AudioCode index may have changed since audioIcon parent was last
          // rendered.
          const sels = updatedAudioSelections(selection, renderPromise);
          if (!renderPromise?.waiting()) {
            if (defaults && swordModule in defaults)
              sels.sort((a) =>
                a.conf.module === defaults[swordModule] ? -1 : 0,
              );
            audioHandler(sels[0]?.selection ?? null, e);
          }
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

import React from 'react';
import { Icon } from '@blueprintjs/core';
import { audioSelections } from '../../common.ts';
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
    const selections = audioSelections(
      G.Tab[swordModule].isVerseKey
        ? {
            swordModule,
            book: bookOrKey as OSISBookType,
            chapter: chapter as number,
          }
        : {
            swordModule,
            key: bookOrKey,
          },
      renderPromise,
    );
    if (!renderPromise.waiting() && selections.length) {
      return (
        <div
          className="audio-icon"
          onPointerDown={(e: React.SyntheticEvent) => {
            e.stopPropagation();
            audioHandler(selections[0]?.selection ?? null, e);
          }}
        >
          <Icon icon="volume-up" />
        </div>
      );
    }
  }

  return null;
}

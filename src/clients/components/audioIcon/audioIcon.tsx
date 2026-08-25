import React from 'react';
import C from '../../../constant.ts';
import Icon from '../libxul/icon.tsx';
import { audioSelections } from '../../common.ts';
import { G } from '../../G.ts';
import RenderPromise from '../../renderPromise.ts';
import './audioIcon.css';

import type {
  AudioPlayerFileGB,
  OSISBookType,
  AudioPlayerFileVK,
} from '../../../type.ts';

export default function audioIcon(
  swordModule: string,
  bookOrKey: OSISBookType | string,
  chapter: number | undefined,
  audioHandler: (
    selection: AudioPlayerFileVK | AudioPlayerFileGB | null,
    e: React.SyntheticEvent,
  ) => void,
  renderPromise: RenderPromise,
  size = C.UI.BluePrint.IconSize.LARGE,
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
          <Icon icon="volume-up" size={size} />
        </div>
      );
    }
  }

  return null;
}

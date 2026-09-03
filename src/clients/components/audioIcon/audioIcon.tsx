import React from 'react';
import C from '../../../constant.ts';
import Icon from '../libxul/icon.tsx';
import { audioSelections } from '../../common.ts';
import { G, GI } from '../../G.ts';
import Button from '../libxul/button.tsx';
import './audioIcon.css';

import type {
  AudioPlayerFileGB,
  OSISBookType,
  AudioPlayerFileVK,
  AudioPlayerType,
} from '../../../type.ts';
import type RenderPromise from '../../renderPromise.ts';

export type AudioIconProps = {
  swordModule: string;
  bookOrKey: string;
  chapter?: number;
  audioHandler: (
    selection: AudioPlayerFileVK | AudioPlayerFileGB | null,
    e: React.SyntheticEvent,
  ) => void;
  renderPromise: RenderPromise;
  button?: boolean;
  audio?: AudioPlayerType;
  disableIfNoAudio?: boolean; // default is hide if no audio
};

export default function audioIcon(props: AudioIconProps): JSX.Element | null {
  const {
    swordModule,
    bookOrKey,
    chapter,
    audioHandler,
    renderPromise,
    button,
    audio,
    disableIfNoAudio,
  } = props;
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
    if (disableIfNoAudio || (!renderPromise.waiting() && selections.length)) {
      if (button) {
        return (
          <Button
            className="audio-icon"
            checked={audio?.open ?? true}
            disabled={!(!renderPromise.waiting() && selections.length)}
            icon="volume-up"
            onPointerDown={(e: React.SyntheticEvent) => {
              e.stopPropagation();
              audioHandler(selections[0]?.selection ?? null, e);
            }}
            title={GI.i18n.t('', renderPromise, 'audio.label')}
          />
        );
      }
      return (
        <div
          className="audio-icon"
          onPointerDown={(e: React.SyntheticEvent) => {
            e.stopPropagation();
            audioHandler(selections[0]?.selection ?? null, e);
          }}
        >
          <Icon icon="volume-up" size={C.UI.BluePrint.IconSize.SMALL} />
        </div>
      );
    }
  }

  return null;
}

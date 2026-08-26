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
  checked?: boolean;
};

export default function audioIcon(props: AudioIconProps): JSX.Element | null {
  const {
    swordModule,
    bookOrKey,
    chapter,
    audioHandler,
    renderPromise,
    button,
    checked,
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
    if (!renderPromise.waiting() && selections.length) {
      if (button) {
        return (
          <Button
            checked={checked}
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

import React from 'react';
import C from '../../../constant.ts';
import Icon from '../libxul/icon.tsx';
import {
  audioSelections,
  blockTouchEvents,
  eventHandled,
  remoteAudioSelections,
} from '../../common.ts';
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
    const location = G.Tab[swordModule].isVerseKey
      ? {
          swordModule,
          book: bookOrKey as OSISBookType,
          chapter: chapter as number,
        }
      : {
          swordModule,
          key: bookOrKey,
        };
    let selections: Array<{
      selection: AudioPlayerFileVK | AudioPlayerFileGB;
    }> = audioSelections(location, renderPromise);
    // Audio that is not installed but can be downloaded is shown with a
    // disabled look. Clicking it downloads, installs and plays the audio.
    let notInstalled = false;
    if (!renderPromise.waiting() && !selections.length) {
      selections = remoteAudioSelections(location, renderPromise);
      notInstalled = selections.length > 0;
    }
    const cls = `audio-icon${notInstalled ? ' not-installed' : ''}`;
    if (
      disableIfNoAudio ||
      audio?.open ||
      (!renderPromise.waiting() && selections.length)
    ) {
      if (button) {
        return (
          <Button
            className={cls}
            checked={audio?.open ?? true}
            disabled={
              !audio?.open && !(!renderPromise.waiting() && selections.length)
            }
            icon="volume-up"
            onPointerDown={(e: React.SyntheticEvent) => {
              eventHandled(e);
              audioHandler(selections[0]?.selection ?? null, e);
              blockTouchEvents(C.UI.Events.touchButtons, e);
            }}
            title={GI.i18n.t('', renderPromise, 'audio.label')}
          />
        );
      }
      return (
        <div
          className={cls}
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

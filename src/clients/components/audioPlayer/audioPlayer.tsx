import React from 'react';
import { audioSelections } from '../../common.tsx';
import { GI } from '../../G.ts';
import Menulist from '../libxul/menulist.tsx';
import './audioPlayer.css';

import type {
  AudioPlayerSelectionGB,
  AudioPlayerSelectionVK,
  AudioPrefType,
} from '../../../type.ts';
import type RenderPromise from '../../renderPromise.ts';
import { htmlAttribs } from '../libxul/xul.tsx';

export default function AudioPlayer(props: {
  audio: AudioPrefType;
  renderPromise?: RenderPromise | null;
  audioHandler: (e: React.SyntheticEvent<any>) => void;
}): JSX.Element {
  const { audio, renderPromise, audioHandler } = props;
  const { file, defaults } = audio;
  const { swordModule } = file ?? {};
  const sels = audioSelections(file, renderPromise);
  let index = 0;
  if (sels.length && defaults && swordModule && swordModule in defaults)
    index = sels.findIndex((a) => a.conf.module === defaults[swordModule]);
  if (index < 0) index = 0;
  const src = sels.length
    ? GI.inlineAudioFile('', renderPromise, sels[index].selection)
    : undefined;
  return (
    <div {...htmlAttribs('audioplayer', props)}>
      {audioSelections(
        {
          ...file,
          book: undefined,
          chapter: undefined,
          key: undefined,
        } as AudioPlayerSelectionVK | AudioPlayerSelectionGB,
        renderPromise,
      ).length > 1 && (
        <Menulist
          id="audioCodeSelect"
          value={sels[index].conf.module}
          onChange={audioHandler}
          options={sels.map((s) => {
            return (
              <option key={s.conf.module} value={s.conf.module}>
                {s.conf.Description?.locale}
              </option>
            );
          })}
        />
      )}
      <audio
        controls
        onEnded={audioHandler}
        onCanPlay={audioHandler}
        onPlay={audioHandler}
        autoPlay={!!Build.isWebApp}
        src={src}
      />
    </div>
  );
}

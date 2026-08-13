import React, { createRef, useEffect } from 'react';
import { clone, diff } from '../../../common.ts';
import { audioSelections } from '../../common.ts';
import { onTimeUpdate, parseTimingFile } from '../../audioTiming.ts';
import { GI } from '../../G.ts';
import Menulist from '../libxul/menulist.tsx';
import { htmlAttribs } from '../libxul/xul.tsx';
import './audioPlayer.css';

import type {
  AudioPlayerSelectionGB,
  AudioPlayerSelectionVK,
  AudioPrefType,
} from '../../../type.ts';
import type RenderPromise from '../../renderPromise.ts';
import type { XulswordState } from '../xulsword/xulsword.tsx';

export default function AudioPlayer(props: {
  audio: AudioPrefType;
  renderPromise: RenderPromise;
  audioHandler: (e: React.SyntheticEvent<any>) => void;
  xulswordState: React.Component<any, XulswordState>['setState'];
}): JSX.Element {
  const { audio, renderPromise, audioHandler, xulswordState } = props;
  const { file, defaults } = audio;
  const { swordModule } = file ?? {};

  const sels = audioSelections(file, renderPromise);

  let index = 0;
  if (sels.length && defaults && swordModule && swordModule in defaults)
    index = sels.findIndex((a) => a.conf.module === defaults[swordModule]);
  if (index < 0) index = 0;
  const { audio: src, timing: srctim } = sels.length
    ? GI.inlineAudioFile(
        { audio: '', timing: '' },
        renderPromise,
        sels[index].selection,
      )
    : { audio: undefined, timing: undefined };

  const installedOptions = audioSelections(
    {
      ...file,
      book: undefined,
      chapter: undefined,
      key: undefined,
    } as AudioPlayerSelectionVK | AudioPlayerSelectionGB,
    renderPromise,
  );

  useEffect(() => {
    const { timing } = audio;
    if (srctim) {
      const t = parseTimingFile(srctim);
      if (diff(timing, t)) {
        xulswordState((prevState) => {
          const { audio: a } = prevState;
          const audio = clone(a);
          audio.timing = t;
          return { audio };
        });
      }
    }
  });

  const audioDOM = createRef() as React.RefObject<HTMLAudioElement>

  return (
    <div {...htmlAttribs('audioplayer', props)}>
      {installedOptions.length > 1 && (
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
        onTimeUpdate={() => onTimeUpdate(audio, audioDOM)}
        autoPlay={!!Build.isWebApp}
        src={src}
        ref={audioDOM}
      />
    </div>
  );
}

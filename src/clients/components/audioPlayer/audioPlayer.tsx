import React, { createRef, useEffect } from 'react';
import { clone, diff } from '../../../common.ts';
import { audioSelections } from '../../common.ts';
import {
  getTimingFile,
  onTimeUpdate,
  parseTimingFile,
} from '../../audioTiming.ts';
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
import log from '../../log.ts';

const TimingFetched: {
  [url: string]: ReturnType<typeof parseTimingFile> | null;
} = {};

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
  const { audio: src, timing: iafTiming } = sels.length
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
    // iafTiming from inlineAudioFile may be a URL, in which case the raw
    // timing must be fetched from the server, or it may be the raw timing
    // itself. If it is a URL, the raw timing should be fetched only once from
    // the server, and the response reused.
    let times: ReturnType<typeof parseTimingFile> | null = null;
    // If iafTiming is a URL, then fetch raw timing (and apply it if needed).
    if (iafTiming?.startsWith('http')) {
      if (!Object.hasOwn(TimingFetched, iafTiming)) {
        TimingFetched[iafTiming] = null;
        getTimingFile(iafTiming)
          .then((rawTiming) => {
            const t = parseTimingFile(rawTiming);
            TimingFetched[iafTiming] = t;
            if (rawTiming && diff(timing, t)) {
              xulswordState((prevState) => {
                const { audio: a } = prevState;
                const audio = clone(a);
                audio.timing = t;
                return { audio };
              });
            }
          })
          .catch((er) => log.error(er));
      } else times = TimingFetched[iafTiming];
    } else if (iafTiming) {
      // Otherwise iafTiming is the raw timing.
      times = parseTimingFile(iafTiming);
    }
    if (times && diff(timing, times)) {
      xulswordState((prevState) => {
        const { audio: a } = prevState;
        const audio = clone(a);
        audio.timing = times;
        return { audio };
      });
    }
  });

  const audioDOM = createRef() as React.RefObject<HTMLAudioElement>;

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

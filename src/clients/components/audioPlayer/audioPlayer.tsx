import React, { createRef, useEffect } from 'react';
import { clone, diff } from '../../../common.ts';
import S from '../../../defaultPrefs.ts';
import { audioSelections } from '../../common.ts';
import {
  getTimingFile,
  onTimeUpdate,
  parseTimingFile,
} from '../../audioTiming.ts';
import { GI } from '../../G.ts';
import log from '../../log.ts';
import Menulist from '../libxul/menulist.tsx';
import Button from '../libxul/button.tsx';
import { Hbox } from '../libxul/boxes.tsx';
import { htmlAttribs, XulProps } from '../libxul/xul.tsx';
import './audioPlayer.css';

import type {
  AudioPlayerFileGB,
  AudioPlayerFileVK,
  AudioPlayerType,
} from '../../../type.ts';
import type RenderPromise from '../../renderPromise.ts';
import type { XulswordState } from '../xulsword/xulsword.tsx';

const TimingFetched: {
  [url: string]: ReturnType<typeof parseTimingFile> | null;
} = {};

export default function AudioPlayer(
  props: {
    audio: AudioPlayerType;
    renderPromise: RenderPromise;
    audioHandler: (e: React.SyntheticEvent<any>) => void;
    xulswordState: React.Component<any, XulswordState>['setState'];
  } & XulProps,
): JSX.Element {
  const { audio, renderPromise, audioHandler, xulswordState } = props;
  const { file, defaults, tracking } = audio;
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

  useEffect(() => {
    if (file) {
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
              if (rawTiming) {
                const t = parseTimingFile(rawTiming);
                TimingFetched[iafTiming] = t;
                xulswordState(checkTimesState(t));
              }
            })
            .catch((er) => log.error(er));
        } else times = TimingFetched[iafTiming];
      } else if (iafTiming) {
        // Otherwise iafTiming is the raw timing.
        times =
          iafTiming in TimingFetched && TimingFetched[iafTiming]
            ? TimingFetched[iafTiming]
            : parseTimingFile(iafTiming);
        TimingFetched[iafTiming] = times;
      }
      if (times) {
        xulswordState(checkTimesState(times));
      }
    }
  }, [file, iafTiming]);

  const installedOptions = audioSelections(
    {
      ...file,
      book: undefined,
      chapter: undefined,
      key: undefined,
    } as AudioPlayerFileVK | AudioPlayerFileGB,
    renderPromise,
  );
  const audioDOM = createRef() as React.RefObject<HTMLAudioElement>;

  const trackingIsOn =
    typeof tracking === 'undefined'
      ? S.prefs.xulsword.audio.tracking
      : tracking;

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
      {audio.open && (
        <Hbox>
          <audio
            controls
            onEnded={audioHandler}
            onCanPlay={audioHandler}
            onPlay={audioHandler}
            onTimeUpdate={() => onTimeUpdate(audio, audioDOM, xulswordState)}
            autoPlay={!!Build.isWebApp}
            src={src}
            ref={audioDOM}
          />
          {audio.file?.timing && (
            <Button
              className="tracking"
              checked={trackingIsOn}
              icon="highlight"
              onPointerDown={() => xulswordState(toggleTrackingState())}
            />
          )}
        </Hbox>
      )}
    </div>
  );
}

// Take a times object and update the state with it only if possible and
// necessary.
function checkTimesState(times: ReturnType<typeof parseTimingFile>) {
  return (prevState: XulswordState) => {
    const { audio: a } = prevState;
    const audio = clone(a);
    const { file } = audio;
    if (file) {
      const { timing } = file;
      if (diff(timing, times)) {
        audio.file = file;
        audio.file.timing = times;
        return { audio };
      }
    }
    return null;
  };
}

function toggleTrackingState() {
  return (prevState: XulswordState) => {
    const { audio: a } = prevState;
    const audio = clone(a);
    audio.tracking =
      typeof audio.tracking === 'undefined'
        ? !S.prefs.xulsword.audio.tracking
        : !audio.tracking;
    const typeScriptFix: Partial<XulswordState> = audio.tracking
      ? { audio }
      : // When tracking turns off, atext panels will re-render, so any multi-
        // column Bible panels that have been paged will REQUIRE verseAt top
        // to keep current page. verseAt top works fine for single culumns too.
        { audio, selection: null, scroll: { verseAt: 'top' } };
    return typeScriptFix as any;
  };
}

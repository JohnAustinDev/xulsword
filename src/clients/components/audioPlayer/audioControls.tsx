import React, { useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { GI } from '../../G.ts';
import log from '../../log.ts';

import type RenderPromise from '../../renderPromise.ts';

// Media controls for an audio element, drawn by xulsword so that they look the
// same in every browser and in Electron. Browsers each draw the native
// controls of <audio controls> their own way, and CSS cannot restyle them. The
// look follows Chrome's native audio controls: play/pause, time, timeline,
// volume (whose slider opens on hover) and a menu with Download and Playback
// speed. The <audio> element itself has no controls attribute, so it is not
// displayed, but it stays in the DOM where other code finds it by tag name.

type AudioControlsProps = {
  audioRef: React.RefObject<HTMLAudioElement>;
  src?: string;
  autoPlay?: boolean;
  // File name (without extension) to give a downloaded audio file, when its
  // URL does not provide one.
  downloadName: string;
  // Called when the user chooses to download the audio file.
  onDownload?: () => void;
  onEnded: (e: React.SyntheticEvent<HTMLAudioElement>) => void;
  onCanPlay: (e: React.SyntheticEvent<HTMLAudioElement>) => void;
  onPlay: (e: React.SyntheticEvent<HTMLAudioElement>) => void;
  onTimeUpdate: () => void;
  renderPromise: RenderPromise;
};

type MenuState = {
  view: 'main' | 'speed';
  // Fixed position of the menu, which may need to be corrected after it is
  // rendered (see useLayoutEffect below).
  left: number;
  top: number;
  maxHeight: number;
};

type DragState = {
  target: 'timeline' | 'volume';
  value: number; // 0 to 1
};

const Speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// Widths (px) of the parts of the controls, from audioPlayer.css, used to
// decide which parts fit (see below). Without the time, the panel's padding,
// play, mute and more buttons, and the timeline's margins need FixedWidth. At
// rest the timeline should be at least TimelineMin wide. Opening the volume
// slider needs OpenVolumeWidth more, which the timeline gives up.
const FixedWidth = 20 + 32 + 32 + 32 + (16 + 16);
const TimelineMin = 12;
const OpenVolumeWidth = 68 - 10;
const TimeMargin = 5;

const SeekStep = 5; // seconds per arrow key press on the timeline
const VolumeStep = 0.1;

// Material Design icon paths (24x24), as used by Chrome's media controls.
const IconPaths = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  volume:
    'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
  muted:
    'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z',
  more: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  speed:
    'M10 7.5v9l6-4.5zM11 4.07V2.05c-2.01.2-3.84 1-5.32 2.21L7.1 5.69A7.941 7.941 0 0111 4.07zM5.69 7.1L4.26 5.68A9.949 9.949 0 002.05 11h2.02c.18-1.46.76-2.79 1.62-3.9zM4.07 13H2.05c.2 2.01 1 3.84 2.21 5.32l1.43-1.43A7.868 7.868 0 014.07 13zm1.61 6.74A9.981 9.981 0 0011 21.95v-2.02a7.941 7.941 0 01-3.9-1.62l-1.42 1.43zM22 12c0 5.16-3.92 9.42-8.95 9.95v-2.02C16.97 19.41 20 16.05 20 12s-3.03-7.41-6.95-7.93V2.05C18.08 2.58 22 6.84 22 12z',
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
} as const;

function Svg({ icon }: { icon: keyof typeof IconPaths }) {
  return (
    <svg
      className="ac-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d={IconPaths[icon]} />
    </svg>
  );
}

// Format seconds like Chrome: m:ss, or h:mm:ss for an hour or more.
function formatTime(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// The fraction of the media that is buffered, from the start of the buffered
// range that holds the current time (as Chrome shows it).
function bufferedFraction(el: HTMLAudioElement): number {
  const { buffered, currentTime, duration } = el;
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  for (let i = 0; i < buffered.length; i += 1) {
    if (buffered.start(i) <= currentTime && currentTime <= buffered.end(i)) {
      return clamp01(buffered.end(i) / duration);
    }
  }
  return 0;
}

// A file extension for an audio mime type, such as mp3 for audio/mpeg.
function audioExtension(mime: string): string {
  const sub = (mime.split('/')[1] ?? '').replace(/^x-/, '');
  if (!sub || sub === 'mpeg' || sub === 'mp3') return 'mp3';
  if (sub === 'mp4') return 'm4a';
  return sub;
}

// Save the audio file to the user's computer. An http(s) file is fetched and
// saved from a blob, because the download attribute of a link is ignored for
// cross-origin URLs (the link would just open the file). A data: or blob: URL
// (Electron's local audio files) is saved directly: Electron's content
// security policy does not allow fetching data: URLs.
async function downloadAudio(src: string, name: string) {
  let href = src;
  let filename = name;
  let isBlob = false;
  const mime = /^data:([^;,]+)/.exec(src)?.[1];
  if (mime) {
    filename = `${name}.${audioExtension(mime)}`;
  } else if (!src.startsWith('blob:')) {
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      href = URL.createObjectURL(blob);
      isBlob = true;
      // A redirected URL usually ends with the server's file name.
      const leaf = decodeURIComponent(
        new URL(response.url || src).pathname.split('/').pop() ?? '',
      );
      filename = /\.[a-z0-9]{2,4}$/i.test(leaf)
        ? leaf
        : `${name}.${audioExtension(blob.type)}`;
    } catch (er) {
      log.warn(`Audio download fetch failed, opening it instead: ${er}`);
    }
  }
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  // A link that cannot download opens the file in a new window or tab,
  // rather than navigating away from xulsword.
  if (!isBlob && !mime) a.target = '_blank';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (isBlob) setTimeout(() => URL.revokeObjectURL(href), 60000);
}

export default function AudioControls(props: AudioControlsProps) {
  const {
    audioRef,
    src,
    autoPlay,
    downloadName,
    onDownload,
    onEnded,
    onCanPlay,
    onPlay,
    onTimeUpdate,
    renderPromise,
  } = props;

  // The controls show the state of the audio element itself, and re-render
  // whenever one of its media events reports a change.
  const [, update] = useReducer((x: number) => x + 1, 0);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  // The parent creates a new audioRef object on each of its renders, which is
  // only set when React commits. So the controls keep their own ref, which is
  // always current, and also pass the element on to audioRef.
  const elRef = useRef<HTMLAudioElement | null>(null);
  const setAudioRef = (elem: HTMLAudioElement | null) => {
    elRef.current = elem;
    (audioRef as React.MutableRefObject<HTMLAudioElement | null>).current =
      elem;
  };
  const [menu, setMenu] = React.useState<MenuState | null>(null);
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = React.useState(0);

  // Track the panel's width, which follows the window's, to leave out parts
  // that do not fit (see below).
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setPanelWidth(panel.clientWidth));
    ro.observe(panel);
    return () => ro.disconnect();
  }, []);

  const t = (key: string) =>
    GI.i18n.t(key, renderPromise, key, { ns: 'xulsword4' });

  const el = elRef.current;
  const ready = !!src && !!el;
  const paused = el ? el.paused : !autoPlay;
  const duration = el && Number.isFinite(el.duration) ? el.duration : 0;
  const muted = el ? el.muted || el.volume === 0 : false;
  const volume = el ? (el.muted ? 0 : el.volume) : 1;
  const rate = el ? el.defaultPlaybackRate : 1;
  const played =
    drag?.target === 'timeline'
      ? drag.value
      : duration && el
        ? clamp01(el.currentTime / duration)
        : 0;
  const buffered = el ? Math.max(bufferedFraction(el), played) : 0;
  const shownVolume = drag?.target === 'volume' ? drag.value : volume;
  const currentTime =
    drag?.target === 'timeline'
      ? drag.value * duration
      : (el?.currentTime ?? 0);

  // Close the menu when the user clicks elsewhere, presses Escape, or when
  // the page scrolls or resizes (which would move its button).
  useEffect(() => {
    if (!menu) return undefined;
    const inside = (e: Event) => {
      const path = e.composedPath();
      return [menuRef.current, moreRef.current].some(
        (n) => n && path.includes(n),
      );
    };
    const close = (e: Event) => {
      if (!inside(e)) setMenu(null);
    };
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(null);
        moreRef.current?.focus();
      }
    };
    const resize = () => setMenu(null);
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('scroll', close, true);
    document.addEventListener('keydown', keydown, true);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', keydown, true);
      window.removeEventListener('resize', resize);
    };
  }, [menu]);

  // The menu is position:fixed so that no overflow:hidden ancestor clips it.
  // But a transformed ancestor (such as on a page hosting the web app) would
  // make it fixed relative to that ancestor instead of the viewport, so its
  // rendered position is checked and corrected.
  useLayoutEffect(() => {
    const m = menuRef.current;
    if (menu && m) {
      const r = m.getBoundingClientRect();
      const dx = Math.round(r.left - menu.left);
      const dy = Math.round(r.top - menu.top);
      if (dx || dy) {
        m.style.left = `${menu.left - dx}px`;
        m.style.top = `${menu.top - dy}px`;
      }
      const first = m.querySelector('button');
      if (first) first.focus({ preventScroll: true });
    }
  }, [menu]);

  // Like Chrome, the menu opens above and to the left of its button's center,
  // unless there is not enough room above it.
  const openMenu = (view: MenuState['view']) => {
    const b = moreRef.current?.getBoundingClientRect();
    if (!b) return;
    const width = 200;
    // Row heights are those of audioPlayer.css.
    const rowHeight = 46;
    const speedRowHeight = 40;
    const height =
      view === 'main'
        ? 2 * rowHeight
        : rowHeight + Speeds.length * speedRowHeight;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    const margin = 4;
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    const left = Math.max(margin, Math.min(cx - width, vw - width - margin));
    let top = cy - height;
    if (top < margin) top = Math.min(cy, vh - height - margin);
    top = Math.max(margin, top);
    setMenu({ view, left, top, maxHeight: vh - top - margin });
  };

  const togglePlay = () => {
    if (!el || !src) return;
    if (el.paused || el.ended) el.play().catch(() => {});
    else el.pause();
  };

  const toggleMute = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!el) return;
    // A mouse click (detail > 0) focuses the button, which would keep the
    // volume slider open after the pointer leaves (see audioPlayer.css).
    if (e.detail) e.currentTarget.blur();
    if (el.muted || el.volume === 0) {
      el.muted = false;
      if (el.volume === 0) el.volume = 1;
    } else el.muted = true;
  };

  const setVolume = (v: number) => {
    if (!el) return;
    el.volume = clamp01(v);
    el.muted = v <= 0;
  };

  const seek = (fraction: number) => {
    if (el && duration) el.currentTime = clamp01(fraction) * duration;
  };

  const setRate = (r: number) => {
    if (!el) return;
    // The default rate is also set, so that the speed is kept for the next
    // chapter's audio (loading new audio resets playbackRate to it).
    el.defaultPlaybackRate = r;
    el.playbackRate = r;
    update();
  };

  // Pointer dragging of the timeline and volume sliders.
  const sliderPointer = (
    target: DragState['target'],
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!ready || (target === 'timeline' && !duration)) return;
    if (e.type === 'pointerdown' && e.button !== 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const value = clamp01((e.clientX - r.left) / (r.width || 1));
    const apply = () =>
      target === 'timeline' ? seek(value) : setVolume(value);
    switch (e.type) {
      case 'pointerdown': {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({ target, value });
        apply();
        break;
      }
      case 'pointermove': {
        if (drag?.target === target) {
          setDrag({ target, value });
          apply();
        }
        break;
      }
      default: {
        // pointerup, pointercancel, lostpointercapture. The slider is blurred
        // so that its thumb (or the volume slider) does not stay open after
        // the pointer leaves it. Keyboard users focus it with Tab instead.
        if (drag?.target === target) {
          setDrag(null);
          e.currentTarget.blur();
        }
      }
    }
  };

  const sliderKey = (
    target: DragState['target'],
    e: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (!el || !ready) return;
    const timeline = target === 'timeline';
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        if (timeline) el.currentTime = Math.max(0, el.currentTime - SeekStep);
        else setVolume(volume - VolumeStep);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        if (timeline)
          el.currentTime = Math.min(duration, el.currentTime + SeekStep);
        else setVolume(volume + VolumeStep);
        break;
      case 'Home':
        if (timeline) seek(0);
        else setVolume(0);
        break;
      case 'End':
        if (timeline) seek(1);
        else setVolume(1);
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const sliderHandlers = (target: DragState['target']) => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) =>
      sliderPointer(target, e),
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) =>
      sliderPointer(target, e),
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) =>
      sliderPointer(target, e),
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) =>
      sliderPointer(target, e),
    onLostPointerCapture: (e: React.PointerEvent<HTMLDivElement>) =>
      sliderPointer(target, e),
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => sliderKey(target, e),
  });

  const pct = (n: number) => `${(n * 100).toFixed(3)}%`;

  const classes = ['audio-controls'];
  if (!ready) classes.push('disabled');
  if (drag) classes.push(`dragging-${drag.target}`);
  if (menu) classes.push('menu-open');
  // Like Chrome, leave out the time, then the volume slider, then the mute
  // button, then the timeline, when the controls are too narrow for them. The time is measured
  // even while hidden. Until the panel is measured, everything shows.
  if (panelWidth) {
    const timeWidth = (timeRef.current?.offsetWidth ?? 0) + TimeMargin;
    const rest = FixedWidth + TimelineMin;
    const open = FixedWidth + OpenVolumeWidth;
    if (panelWidth < Math.max(rest, open) + timeWidth)
      classes.push('hide-time');
    if (panelWidth < Math.max(rest, open)) classes.push('hide-volume-slider');
    if (panelWidth < rest) classes.push('hide-mute');
    if (panelWidth < rest - 32) classes.push('hide-timeline');
  }

  return (
    <div className={classes.join(' ')} dir="ltr">
      <audio
        onEnded={onEnded}
        onCanPlay={(e) => {
          update();
          onCanPlay(e);
        }}
        onPlay={(e) => {
          update();
          onPlay(e);
        }}
        onTimeUpdate={() => {
          update();
          onTimeUpdate();
        }}
        onPause={update}
        onPlaying={update}
        onLoadedMetadata={update}
        onDurationChange={update}
        onProgress={update}
        onSeeked={update}
        onVolumeChange={update}
        onRateChange={update}
        onEmptied={update}
        autoPlay={autoPlay}
        src={src}
        ref={setAudioRef}
      />
      <svg className="ac-sizer" aria-hidden="true" focusable="false" />
      <div className="ac-panel" ref={panelRef}>
        <button
          type="button"
          className="ac-button ac-play"
          disabled={!ready}
          aria-label={t(paused ? 'Play' : 'Pause')}
          onClick={togglePlay}
        >
          <Svg icon={paused ? 'play' : 'pause'} />
        </button>
        <div className="ac-time" ref={timeRef}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
        <div
          className="ac-slider ac-timeline"
          role="slider"
          tabIndex={ready ? 0 : -1}
          aria-label={t('Seek')}
          aria-valuemin={0}
          aria-valuemax={Math.floor(duration)}
          aria-valuenow={Math.floor(currentTime)}
          aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
          {...sliderHandlers('timeline')}
        >
          <div className="ac-track">
            <div className="ac-buffered" style={{ width: pct(buffered) }} />
            <div className="ac-fill" style={{ width: pct(played) }} />
          </div>
          <div className="ac-thumb" style={{ left: pct(played) }} />
        </div>
        <div className="ac-volume">
          <div className="ac-volume-slider-box">
            <div
              className="ac-slider ac-volume-slider"
              role="slider"
              tabIndex={ready ? 0 : -1}
              aria-label={t('Volume')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(shownVolume * 100)}
              {...sliderHandlers('volume')}
            >
              <div className="ac-track">
                <div className="ac-fill" style={{ width: pct(shownVolume) }} />
              </div>
              <div className="ac-thumb" style={{ left: pct(shownVolume) }} />
            </div>
          </div>
          <button
            type="button"
            className="ac-button ac-mute"
            disabled={!ready}
            aria-label={t(muted ? 'Unmute' : 'Mute')}
            onClick={toggleMute}
          >
            <Svg icon={muted ? 'muted' : 'volume'} />
          </button>
        </div>
        <button
          type="button"
          className="ac-button ac-more"
          ref={moreRef}
          disabled={!ready}
          aria-label={t('More options')}
          aria-haspopup="menu"
          aria-expanded={!!menu}
          onClick={() => (menu ? setMenu(null) : openMenu('main'))}
        >
          <Svg icon="more" />
        </button>
      </div>
      {menu && (
        <div
          className={`ac-menu ac-menu-${menu.view}`}
          role="menu"
          ref={menuRef}
          style={{ left: menu.left, top: menu.top, maxHeight: menu.maxHeight }}
        >
          {menu.view === 'main' && (
            <>
              <button
                type="button"
                role="menuitem"
                className="ac-menuitem"
                onClick={() => {
                  setMenu(null);
                  if (src) {
                    downloadAudio(src, downloadName).catch((er) =>
                      log.error(er),
                    );
                    if (onDownload) onDownload();
                  }
                }}
              >
                <Svg icon="download" />
                <span>{t('Download')}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="ac-menuitem"
                onClick={() => openMenu('speed')}
              >
                <Svg icon="speed" />
                <span>{t('Playback speed')}</span>
              </button>
            </>
          )}
          {menu.view === 'speed' && (
            <>
              <button
                type="button"
                role="menuitem"
                className="ac-menuitem ac-menuheader"
                onClick={() => openMenu('main')}
              >
                <Svg icon="back" />
                <span>{t('Playback speed')}</span>
              </button>
              {Speeds.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitemradio"
                  aria-checked={s === rate}
                  className={`ac-menuitem ac-speed${s === rate ? ' selected' : ''}`}
                  onClick={() => {
                    setRate(s);
                    setMenu(null);
                    moreRef.current?.focus();
                  }}
                >
                  <span>{s === 1 ? t('Normal') : String(s)}</span>
                  {s === rate && <Svg icon="check" />}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

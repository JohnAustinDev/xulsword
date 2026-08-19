import log from './log.ts';

import type { AudioPrefType } from '../type.ts';

type TimingEntry = {
  start: number;
  end: number;
  id: string;
  additionalSeparators: string;
};

type TimingSettings = {
  level: 'phrase' | 'verse';
  separators: string;
};

type TextMap = {
  node: Node;
  startIdx: number;
  endIdx: number;
};

const CurrentActiveIds = new Set<string>();

// Stops and removes the moving highlight bar from a span.
function clearHighlightSweep(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('nowreading');
    el.style.transition = '';
    el.style.backgroundPosition = '';
  }
}

// Animates a highlight bar across a 'nowreading' span's text, from
// inline-start to inline-end, timed to land exactly on item.end. A CSS
// transition (rather than per-frame JS updates) drives the motion, so the
// browser keeps it smooth; background-position's own percentage formula
// (offset = (boxSize - imageSize) * pct) naturally accounts for the bar's
// width, so 0%/100% land it flush with each edge.
function startHighlightSweep(
  el: HTMLElement,
  item: TimingEntry,
  currentTime: number,
) {
  el.classList.add('nowreading');

  const duration = item.end - item.start;
  const elapsedFraction =
    duration > 0
      ? Math.min(1, Math.max(0, (currentTime - item.start) / duration))
      : 0;
  const remaining = Math.max(0, item.end - currentTime);

  // Reading direction determines which edge is "inline-start": the span
  // inherits dir/direction from its module (see zversekey RTL handling).
  const rtl = getComputedStyle(el).direction === 'rtl';
  const startPct = rtl ? (1 - elapsedFraction) * 100 : elapsedFraction * 100;
  const endPct = rtl ? 0 : 100;

  // Snap to the correct starting position with no transition, then force
  // layout so the browser registers it before the animated move begins.
  el.style.transition = 'none';
  el.style.backgroundPosition = `${startPct}% 0`;
  void el.offsetWidth;

  el.style.transition = `background-position ${remaining}s linear`;
  el.style.backgroundPosition = `${endPct}% 0`;
}

export function onTimeUpdate(
  audio: AudioPrefType,
  audioDOM: React.RefObject<HTMLAudioElement>,
) {
  const { timing } = audio;
  const { current: player } = audioDOM;
  if (timing && player) {
    const { times } = timing;
    if (player) {
      const { currentTime } = player;

      // Find the item(s) matching the current playback time
      const activeItems = times.filter(
        (item) => currentTime >= item.start && currentTime < item.end,
      );

      // Only update the DOM if the active verse has actually changed
      if (activeItems.length) {
        // Clear previous highlights
        CurrentActiveIds.forEach((id) => {
          if (!activeItems.find((i) => i.id === id)) {
            clearHighlightSweep(id);
          }
          CurrentActiveIds.delete(id);
        });
        // Add new highlights
        activeItems.forEach((item) => {
          if (CurrentActiveIds.has(item.id)) return;
          const currentElement = document.getElementById(item.id);
          if (currentElement) {
            startHighlightSweep(currentElement, item, currentTime);
            // Optional: Smoothly scroll long text into view
            currentElement.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
            });
            CurrentActiveIds.add(item.id);
          }
        });
      } else {
        // Clear highlight if audio moves outside covered timing windows
        CurrentActiveIds.forEach((id) => {
          clearHighlightSweep(id);
          CurrentActiveIds.delete(id);
        });
      }
    }
  }
}

export function onClick(elem: HTMLElement) {
  const player: HTMLAudioElement | undefined = document
    .getElementById('player')
    ?.getElementsByTagName('audio')[0];
  if (player) {
    const startTime = parseFloat(elem.getAttribute('data-start') ?? '');
    if (!Number.isNaN(startTime)) {
      player.currentTime = startTime; // Cue audio to the timestamp
      player.play().catch((er) => {
        log.error(er);
      });
    }
  }
}

export function addTimingSpans(
  divElement: HTMLDivElement,
  timing: ReturnType<typeof parseTimingFile>,
) {
  const { times, settings } = timing;
  const { level, separators } = settings;

  // Identify and isolate container zones (verses and titles).
  // TODO!! Support more than just Bible text.
  // TODO!! Support titles
  const zones = divElement.querySelectorAll(':scope > .vs');
  const skipClass = ['versenum', 'cr', 'fn'];

  let timingIndex = 0;

  if (timing.times.length && zones.length) {
    const style = document.createElement('style');
    style.innerHTML = '.versenum:hover { cursor: pointer; }';
    divElement.prepend(style);
  }

  zones.forEach((zone) => {
    if (timingIndex >= times.length) return;

    const zoneSeparators: string[] = separators.split('');

    const zoneID =
      zone.querySelector(':scope > .versenum')?.textContent.trim() ?? '';

    let { zoneid } = parseTimingID(times[timingIndex].id);
    if (zoneid && zoneid !== zoneID) {
      const zoneVerseStart = Number(zoneID.replace(/^(\d+).*?$/, '$1'));
      const zoneVerseEnd = Number(zoneID.replace(/^.*?(\d+)$/, '$1'));
      if (zoneVerseEnd < Number(zoneid?.replace(/^(\d+).*?$/, '$1'))) return;
      while (zoneVerseStart > Number(zoneid?.replace(/^.*?(\d+)$/, '$1'))) {
        timingIndex++;
        if (timingIndex >= times.length) return;
        ({ zoneid } = parseTimingID(times[timingIndex].id));
      }
    }

    // Extract a structural text map of this zone
    const textMap: TextMap[] = [];
    let totalLength = 0;

    function mapNode(node: HTMLElement) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue;
        textMap.push({
          node: node,
          startIdx: totalLength,
          endIdx: totalLength + (text?.length ?? 0),
        });
        totalLength += text?.length ?? 0;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Completely skip these classes (don't map their text content)
        if (skipClass.some((c) => node.classList.contains(c))) {
          return;
        }
        // Process everything else normally
        for (const child of node.childNodes) {
          mapNode(child as HTMLElement);
        }
      }
    }

    // Populate our text map for the current container
    for (const child of zone.childNodes) {
      mapNode(child as HTMLElement);
    }

    // Reconstruct the safe flat text string for aeneas rule matching
    const flatText = textMap.map((m) => m.node.nodeValue ?? '').join('');

    let segmentStart = 0;

    // Child elements (eg. inline markup spans) that wrap text nodes must
    // remain untouched and be moved whole into the first synchronization
    // span that claims any of their text, rather than being split across
    // multiple spans or emptied out. Track which ones have already been
    // claimed so later segments in this zone leave them alone.
    const claimedContainers = new Set<Node>();

    // Tracks where the current phrase begins in flatText. A timing id's word
    // number marks where THAT entry's own audio starts within its phrase
    // (eg. word 3 means "starts right after the 3rd word"), which is exactly
    // where the PRECEDING entry's span must end. So each span's end boundary
    // is found by looking ahead at the next timing id, not from its own id.
    let currentPhrase: number | null = null;
    let phraseStart = segmentStart;

    // Match segments within this zone block
    while (
      segmentStart < flatText.length &&
      timingIndex < times.length &&
      zoneID === parseTimingID(times[timingIndex].id).zoneid
    ) {
      const { phrase } = parseTimingID(times[timingIndex].id);

      if (phrase !== currentPhrase) {
        currentPhrase = phrase;
        phraseStart = segmentStart;
      }

      const next =
        timingIndex + 1 < times.length
          ? parseTimingID(times[timingIndex + 1].id)
          : null;

      let segmentEnd: number;
      if (
        next &&
        next.zoneid === zoneID &&
        next.phrase === phrase &&
        next.word !== -1
      ) {
        // The next entry continues this same phrase and marks where its own
        // audio starts; that is exactly where this span ends.
        const wordEnd = findNthWordEnd(flatText, phraseStart, next.word);
        if (wordEnd === null || wordEnd <= segmentStart) break;
        segmentEnd = wordEnd;
      } else {
        // According to the timing file specification, an additional separator
        // may be suffixed to the initial verse id and it applies to all
        // following phrases of the verse, as well as the initial phrase. Here,
        // the suffix as allowed on any phrase, not just the first.
        times[timingIndex].additionalSeparators.split('').forEach((c) => {
          if (!zoneSeparators.includes(c)) zoneSeparators.push(c);
        });

        // Last entry of the phrase: end at the phrase's punctuation boundary.
        const punc: string = zoneSeparators.join('');
        const re = new RegExp(`[^${punc}]+[${punc}]+`);
        const match = flatText.substring(segmentStart).match(re);
        if (!match) break;
        segmentEnd = segmentStart + (match.index ?? 0) + match[0].length;
      }

      // Wrap this segment in a synchronization span
      wrapTextRange(
        zone,
        textMap,
        segmentStart,
        segmentEnd,
        times[timingIndex],
        claimedContainers,
      );

      segmentStart = segmentEnd;
      timingIndex++;
    }

    // Catch any remaining text in the zone if punctuation didn't trail the end
    if (
      segmentStart < flatText.length &&
      timingIndex < times.length &&
      zoneID === parseTimingID(times[timingIndex].id).zoneid
    ) {
      wrapTextRange(
        zone,
        textMap,
        segmentStart,
        flatText.length,
        times[timingIndex],
        claimedContainers,
      );
      timingIndex++;
    }
  });
}

function parseTimingID(id: string) {
  const idParts = id.split('_');
  const level = idParts.shift();
  let zoneid = idParts.shift();
  let phrase;
  if (/^[A-Za-z]+$/.test(zoneid ?? '')) {
    phrase = zoneid;
    zoneid = '';
  } else {
    phrase = idParts.shift();
  }
  const word = idParts.shift();

  return {
    level,
    zoneid,
    phrase: phraseToNumber(phrase ?? 'a'),
    word: Number(word ?? -1),
  };
}

/**
 * Finds the index immediately following the wordCount-th word (1-based),
 * counting words from fromIdx in text. Words are runs of non-whitespace
 * characters; each word's leading whitespace is included with that word, so
 * consecutive boundaries partition the text with no gaps. Returns null if
 * text does not contain that many words starting at fromIdx.
 */
function findNthWordEnd(
  text: string,
  fromIdx: number,
  wordCount: number,
): number | null {
  const re = /\s*\S+/g;
  const substring = text.slice(fromIdx);
  let match: RegExpExecArray | null;
  let count = 0;
  while ((match = re.exec(substring))) {
    count++;
    if (count === wordCount) {
      return fromIdx + match.index + match[0].length;
    }
  }
  return null;
}

/**
 * As pieces of a segment are pulled into its synchronization span from
 * various points in the zone, any sibling nodes that carry no mapped text
 * (eg. empty markup spans, or skipped elements like versenum/cr/fn) can be
 * left stranded between the span and the next piece being claimed. Moving
 * them into the span too preserves their original relative order instead of
 * letting later text jump ahead of them.
 */
function moveUnclaimedSiblings(span: HTMLElement, target: Node) {
  while (span.nextSibling && span.nextSibling !== target) {
    span.appendChild(span.nextSibling);
  }
}

/**
 * Mutates the DOM elements within a specific text character span
 * while cleanly keeping note nodes intact and untouched.
 */
function wrapTextRange(
  zone: Element,
  textMap: TextMap[],
  startIdx: number,
  endIdx: number,
  timingItem: TimingEntry,
  claimedContainers: Set<Node>,
) {
  const doc = zone.ownerDocument;
  const span = doc.createElement('span');
  span.id = timingItem.id;
  span.className = 'verse-sync';
  span.setAttribute('data-start', timingItem.start.toString());

  let firstInserted = false;

  textMap.forEach((map) => {
    // Determine if this text node overlaps with our phrase boundaries
    const overlapStart = Math.max(startIdx, map.startIdx);
    const overlapEnd = Math.min(endIdx, map.endIdx);

    const parent = map.node.parentNode;

    if (parent && parent !== zone && overlapStart < overlapEnd) {
      // This text node lives inside a child element (eg. inline markup)
      // rather than directly in the zone. That element must remain
      // untouched, so move it whole into the first span that claims any
      // of its text instead of slicing its text node.
      let container: Node = map.node;
      while (container.parentNode && container.parentNode !== zone) {
        container = container.parentNode;
      }

      if (claimedContainers.has(container)) return;
      claimedContainers.add(container);

      if (!firstInserted) {
        zone.replaceChild(span, container);
        firstInserted = true;
      } else {
        moveUnclaimedSiblings(span, container);
      }
      if (span !== container) span.appendChild(container);
      return;
    }

    if (parent && overlapStart < overlapEnd) {
      const localStart = overlapStart - map.startIdx;
      const localEnd = overlapEnd - map.startIdx;

      const fullText = map.node.nodeValue ?? '';

      const segmentText = fullText.substring(localStart, localEnd);
      const textNode = doc.createTextNode(segmentText);

      if (firstInserted) {
        moveUnclaimedSiblings(span, map.node);
      }
      span.appendChild(textNode);

      // Mutate the original node to remove the sliced-out phrase text
      if (localStart === 0 && localEnd === fullText.length) {
        // If the entire text node is consumed, prepare to substitute it
        if (!firstInserted) {
          parent.replaceChild(span, map.node);
          firstInserted = true;
        } else {
          parent.removeChild(map.node);
        }
      } else {
        // If it's a partial node slice, adjust lengths cleanly
        const remainderText = fullText.substring(localEnd);
        map.node.nodeValue = fullText.substring(0, localStart);

        if (!firstInserted) {
          if (map.node.nextSibling) {
            parent.insertBefore(span, map.node.nextSibling);
          } else {
            parent.appendChild(span);
          }
          firstInserted = true;
        }

        if (remainderText) {
          const remainderNode = doc.createTextNode(remainderText);
          parent.insertBefore(remainderNode, span.nextSibling);

          // Keep the text map in sync with the DOM: later segments in this
          // zone must continue reading from this remainder node (using
          // offsets relative to it), not the now-truncated original node.
          map.node = remainderNode;
          map.startIdx = overlapEnd;
        }
      }
    }
  });
}

export function parseTimingFile(timing: string): {
  times: TimingEntry[];
  settings: TimingSettings;
} {
  // Split file into individual lines
  const lines = timing.trim().split(/\r?\n/);

  const settings = {
    level:
      (lines
        .find((l) => l.startsWith('\\level'))
        ?.replace(/^\\level\s+(\S+)\s*$/, '$1') as 'phrase' | 'verse') ??
      ('phrase' as const),
    separators:
      lines
        .find((l) => l.startsWith('\\separators'))
        ?.replace(/^\\separators\s+(\S+)\s*$/, '$1') ?? '.?!:,',
  };
  const { level } = settings;

  let lastZoneID = '';
  let lastPhrase = '';

  const times: (TimingEntry | null)[] = lines.filter(Boolean).map((line) => {
    if (line.startsWith('\\')) return null;

    const parts = line.trim().split(/\s+/);

    // Ensure the line has at least start and end times
    if (parts.length < 2) {
      log.error(`Timing file unhandled line (columns): ${line}`);
      return null;
    }

    // Ensure first two columns are numbers
    const start = parseFloat(parts[0]);
    const end = parseFloat(parts[1]);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      log.error(`Timing file unhandled line (numbers): ${line}`);
      return null;
    }

    // TODO!!: Support Titles
    // Get the xulsword timing id. The xulsword timing id is different than
    // the id in the timing file, but easier to use. Based on SIL timing file
    // documentation, we must support all expected possibilities
    let zoneid = '';
    let phrase = '';
    let word = '';
    let additionalSeparators = ''; // ids may include additional separators
    if (parts.length === 2) {
      // New verse timing file entries may not all have ids, meaning use an
      // incremented phrase number for previous verse (if any).
      lastPhrase = numberToPhrase(phraseToNumber(lastPhrase) + 1);
      return {
        start,
        end,
        id: [level, lastZoneID, lastPhrase].filter(Boolean).join('_'),
        additionalSeparators,
      };
    } else {
      const m1 = parts[2].match(/^([\d-]+)?([A-Za-z]*)(_(\d+))?(.*?)$/);
      if (m1) [, zoneid, phrase, , word, additionalSeparators] = m1;
      else {
        log.error(`Timing file unhandled line (parse): ${line}`);
      }
      lastZoneID = zoneid;
      if (!phrase) phrase = 'a';
      lastPhrase = phrase;

      return {
        start,
        end,
        id: [level, zoneid, phrase, word].filter(Boolean).join('_'),
        additionalSeparators,
      };
    }
  });

  return { times: times.filter(Boolean) as TimingEntry[], settings };
}

// Returns -1 on error.
function phraseToNumber(phraseid: string): number {
  // Convert to uppercase to handle both 'a' and 'A'
  const name = phraseid.toUpperCase();
  let result = 0;

  for (let i = 0; i < name.length; i++) {
    const charCode = name.charCodeAt(i);
    if (charCode < 65 || charCode > 90) return -1;
    result = result * 26 + (charCode - 65 + 1);
  }

  return result;
}

// Inverse of phraseToNumber. Returns '' on error.
function numberToPhrase(num: number): string {
  if (!Number.isInteger(num) || num < 1) return '';
  let n = num;
  let result = '';

  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }

  return result;
}

export async function getTimingFile(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      log.error(`Failed to get timing file: ${url}`);
    } else {
      const fileContent = await response.text();
      return fileContent;
    }
  } catch (error) {
    log.error(`Error getting timing file: ${error}`);
  }

  return '';
}

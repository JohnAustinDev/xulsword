import { ofClass } from '../common.ts';
import log from './log.ts';
import { getElementData } from './htmlData.ts';

import type { AudioPlayerType } from '../type.ts';
import type { XulswordState } from './components/xulsword/xulsword.tsx';

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

const Highlight = {
  verse: true, // blue highlight and verse center scroll
  phrase: true, // yellow highlight and scrollIntoView nearest
  word: false, // yellow sweep and scrollIntoView nearest
};

const CurrentActiveIds = new Set<string>();

// Stops and removes the moving highlight bar from a span.
function unHighlight(id: string) {
  document.querySelectorAll(`div.sb span[data-id="${id}"]`).forEach((e) => {
    const el = e as HTMLElement;
    el.classList.remove('nowreading');
    el.classList.remove('nowreading-sweep');
    el.style.transition = '';
    el.style.backgroundPosition = '';
  });
}

// Animates a highlight bar across a 'nowreading-sweep' span's text, from
// inline-start to inline-end, timed to land exactly on item.end. A CSS
// transition (rather than per-frame JS updates) drives the motion, so the
// browser keeps it smooth; background-position's own percentage formula
// (offset = (boxSize - imageSize) * pct) naturally accounts for the bar's
// width, so 0%/100% land it flush with each edge.
function doHighlight(
  el: HTMLElement,
  item: TimingEntry,
  currentTime: number,
  xulswordState: React.Component<any, XulswordState>['setState'],
) {
  if (Highlight.verse) {
    const verse = Array.from(CurrentActiveIds).reduce((p, c) => {
      const { zoneid } = parseTimingID(c);
      const v = Number(zoneid?.replace(/^.*?(\d+)$/, '$1') ?? 0);
      return Math.max(p, v);
    }, 0);
    const atext = ofClass(['atext'], el);
    if (atext && verse) {
      const data = getElementData(atext.element);
      const { location } = data;
      if (location) {
        const { verse: v } = location;
        if (v && verse > v) {
          location.verse = verse;
          xulswordState({
            location,
            selection: location,
            scroll: { verseAt: 'center' },
          });
        }
      }
    }
  }
  if (Highlight.phrase) el.classList.add('nowreading');
  if (Highlight.word) {
    el.classList.add('nowreading-sweep');
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
}

export function onTimeUpdate(
  audio: AudioPlayerType,
  audioDOM: React.RefObject<HTMLAudioElement>,
  xulswordState: React.Component<any, XulswordState>['setState'],
) {
  const { file } = audio;
  const { timing } = file ?? {};
  const { current: player } = audioDOM;
  if (timing && player) {
    const { times } = timing;
    const { currentTime } = player;

    // Find any item(s) matching the current playback time
    const activeItems = times.filter(
      (item) => currentTime >= item.start && currentTime < item.end,
    );

    // Only update the DOM if the active verse has actually changed
    if (activeItems.length) {
      // Clear previous highlights
      CurrentActiveIds.forEach((id) => {
        if (!activeItems.find((i) => i.id === id)) {
          unHighlight(id);
          CurrentActiveIds.delete(id);
        }
      });
      // Add new highlights
      activeItems.forEach((item) => {
        document
          .querySelectorAll(`div.sb span[data-id="${item.id}"]`)
          .forEach((e) => {
            const el = e as HTMLElement;
            doHighlight(el, item, currentTime, xulswordState);
            // Optional: Smoothly scroll long text into view
            el.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
            });
            CurrentActiveIds.add(item.id);
          });
      });
    } else {
      // Clear highlight if audio moves outside covered timing windows
      CurrentActiveIds.forEach((id) => {
        unHighlight(id);
        CurrentActiveIds.delete(id);
      });
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
      player.play().catch(() => {});
    }
  }
}

export function addTimingSpans(
  divElement: HTMLDivElement,
  timing: ReturnType<typeof parseTimingFile>,
) {
  const { times, settings } = timing;
  const { level, separators } = settings;

  // Text having these classes is ignored during phrase splitting.
  const skipClass = ['versenum', 'cr', 'fn', 'un'];

  // Identify and isolate container zones (currently verses).
  // TODO!! Support more than just Bible text.
  // TODO!! Support titles
  const zones = divElement.querySelectorAll(':scope > .vs');

  let timingIndex = 0;

  // Timing makes versenum clickable, so add pointer cursor to them.
  if (timing.times.length && zones.length) {
    const style = document.createElement('style');
    style.innerHTML = '.versenum:hover { cursor: pointer; }';
    divElement.prepend(style);
  }

  zones.forEach((zone) => {
    if (timingIndex >= times.length) return;

    const zoneSeparators: string[] = separators.split('');

    // The verse number is normally a direct child of the zone, but poetry
    // lines (eg. rendered from OSIS <l>/<lg> markup as <div class="line">)
    // wrap the zone's content in their own divs, pushing it down to a
    // grandchild or deeper. Search all descendants rather than assuming a
    // fixed depth.
    const zoneID = zone.querySelector('.versenum')?.textContent.trim() ?? '';

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

    // Wrap any remaining text in the zone if break ended the zone loop.
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
 * Finds the nearest div container of a node: either the zone itself,
 * or the closest ancestor <div> (eg. a poetry stanza rendered from an OSIS
 * <div> milestone, which is a descendant of the zone but wraps a whole run
 * of lines/text). Text nodes are split into sync spans relative to this
 * container, the same way they would be relative to the zone, so that a
 * div's text is not swallowed whole by a single timing entry.
 */
function nearestBlockAncestor(parent: Node, zone: Element): Element {
  let node: Node | null = parent;
  while (node && node !== zone) {
    if (node instanceof HTMLElement && node.tagName === 'DIV') return node;
    node = node.parentNode;
  }
  return zone;
}

/**
 * Mutates the DOM elements within a specific text character span
 * while cleanly keeping skipClass nodes intact and untouched.
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

  // A single timing segment's text may cross more than one block container
  // (eg. from the end of one poetry-line div into the next), since segment
  // boundaries are computed from the zone's flat text without regard to div
  // boundaries. A DOM node can only live in one parent, so each block
  // container touched by this segment gets its own sync span (all sharing
  // the same data-id/data-start; the highlighting code already matches on
  // all spans with a given data-id).
  const spans = new Map<
    Element,
    { span: HTMLElement; firstInserted: boolean }
  >();
  function spanFor(container: Element) {
    let entry = spans.get(container);
    if (!entry) {
      const span = doc.createElement('span');
      span.className = 'verse-sync';
      span.setAttribute('data-start', timingItem.start.toString());
      span.setAttribute('data-id', timingItem.id);
      entry = { span, firstInserted: false };
      spans.set(container, entry);
    }
    return entry;
  }

  textMap.forEach((map) => {
    // Determine if this text node overlaps with our phrase boundaries
    const overlapStart = Math.max(startIdx, map.startIdx);
    const overlapEnd = Math.min(endIdx, map.endIdx);
    if (overlapStart >= overlapEnd) return;

    const parent = map.node.parentNode;
    if (!parent) return;

    const blockAncestor = nearestBlockAncestor(parent, zone);
    const entry = spanFor(blockAncestor);
    const { span } = entry;

    if (parent !== blockAncestor) {
      // This text node lives inside inline markup (eg. <hi>, notes) nested
      // within the block container rather than directly in it. That element
      // must remain untouched, so move it whole into the first span (within
      // this container) that claims any of its text instead of slicing its
      // text node.
      let container: Node = map.node;
      while (container.parentNode && container.parentNode !== blockAncestor) {
        container = container.parentNode;
      }

      if (claimedContainers.has(container)) return;
      claimedContainers.add(container);

      if (!entry.firstInserted) {
        blockAncestor.replaceChild(span, container);
        entry.firstInserted = true;
      } else {
        moveUnclaimedSiblings(span, container);
      }
      if (span !== container) span.appendChild(container);
      return;
    }

    const localStart = overlapStart - map.startIdx;
    const localEnd = overlapEnd - map.startIdx;

    const fullText = map.node.nodeValue ?? '';

    const segmentText = fullText.substring(localStart, localEnd);
    const textNode = doc.createTextNode(segmentText);

    if (entry.firstInserted) {
      moveUnclaimedSiblings(span, map.node);
    }
    span.appendChild(textNode);

    // Mutate the original node to remove the sliced-out phrase text
    if (localStart === 0 && localEnd === fullText.length) {
      // If the entire text node is consumed, prepare to substitute it
      if (!entry.firstInserted) {
        parent.replaceChild(span, map.node);
        entry.firstInserted = true;
      } else {
        parent.removeChild(map.node);
      }
    } else {
      // If it's a partial node slice, adjust lengths cleanly
      const remainderText = fullText.substring(localEnd);
      map.node.nodeValue = fullText.substring(0, localStart);

      if (!entry.firstInserted) {
        if (map.node.nextSibling) {
          parent.insertBefore(span, map.node.nextSibling);
        } else {
          parent.appendChild(span);
        }
        entry.firstInserted = true;
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
        ?.replace(/^\\separators[ ]+(.*?)[ ]*$/, '$1') ?? '.?!:,',
  };
  const { level } = settings;

  let lastZoneID = '';
  let lastPhrase = '';

  const times: (TimingEntry | null)[] = lines.filter(Boolean).map((line) => {
    if (line.startsWith('\\')) return null;

    const parts = line.trim().split(/[ \t]+/);

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
      const tt = fileContent.trim();
      return tt !== 'no-timing-file' ? tt : '';
    }
  } catch (error) {
    log.error(`Error getting timing file: ${error}`);
  }

  return '';
}

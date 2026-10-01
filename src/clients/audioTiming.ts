import { clone, ofClass } from '../common.ts';
import S from '../defaultPrefs.ts';
import C from '../constant.ts';
import log from './log.ts';
import { getRootNode } from './rootNode.ts';

import type { AudioPlayerType } from '../type.ts';
import type { XulswordState } from './components/xulsword/xulsword.tsx';

type TimingEntry = {
  start: number;
  end: number;
  id: string;
  additionalSeparators: string;
};

// A timing entry as matched against the text. Its id may differ from the
// timing file's (see combineTimingZones), so dataId holds the timing file
// id(s) the highlighter uses to find its span(s).
type ZoneTimingEntry = TimingEntry & { dataId: string };

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
  verse: true, // blue highlight
  phrase: true, // yellow highlight
  word: false, // yellow sweep
};

const CurrentActiveIds = new Set<string>();

// Timing file ids of titles that are read aloud: a prefix naming the SFM
// marker of the title, followed by the title's order among those of its kind
// in the text (whatever their levels). So s1, s2 etc. are the first, second
// etc. section titles (\s), mt1 the first main title (\mt), d1 the first psalm
// title (\d), sp1 the first speaker title (\sp) and is1 the first introduction
// section title (\is).
const TitleTagRE = /^(s|mt|d|sp|is)(\d+)$/;

// Stops and removes the moving highlight bar from a span.
function unHighlight(id: string) {
  getRootNode()
    .querySelectorAll(`div.sb span[data-id~="${id}"]`)
    .forEach((e) => {
      const el = e as HTMLElement;
      el.classList.remove('nowreading');
      el.classList.remove('nowreading-sweep');
      el.style.transition = '';
      el.style.backgroundPosition = '';
    });
}

function doHighlight(
  el: HTMLElement,
  item: TimingEntry,
  currentTime: number,
  xulswordState: React.Component<any, XulswordState>['setState'],
) {
  if (Highlight.verse) {
    // Get the total verse range of all active zones (titles have none).
    const { verse, lastverse } = Array.from(CurrentActiveIds)
      .filter((id) => !parseTitleID(id))
      .reduce(
        (p, c) => {
          const { zoneid } = parseTimingID(c);
          const [v1, v2] = verseRange(zoneid);
          const { verse, lastverse } = p;
          return {
            verse: Math.min(v1, verse),
            lastverse: Math.max(v2, lastverse),
          };
        },
        { verse: 999, lastverse: 0 },
      );
    const atext = ofClass(['atext'], el);
    if (atext && lastverse) {
      const { verse: vs } = atext.element.dataset;
      const v = Number(vs);
      // Compare it to the selected verse of the atext element.
      if (verse && verse !== v) {
        // Scrolling with the current UI is not nice. Until the player can
        // be a static dispay, it's possible to block the user where audio
        // cannot be stopped! Also the scrolling causes activated input
        // elements to instantly deactivate, annoyingly.
        xulswordState((prevState) => {
          const { location: s } = prevState;
          const selection = clone(s);
          if (selection) {
            selection.verse = verse;
            selection.lastverse = lastverse;
            return {
              selection,
              scroll: null,
            };
          }
          return null;
        });
      }
    }
  }
  if (Highlight.phrase) el.classList.add('nowreading');
  if (Highlight.word) {
    // Animates a highlight bar across a 'nowreading-sweep' span's text, from
    // inline-start to inline-end, timed to land exactly on item.end. A CSS
    // transition (rather than per-frame JS updates) drives the motion, so the
    // browser keeps it smooth; background-position's own percentage formula
    // (offset = (boxSize - imageSize) * pct) naturally accounts for the bar's
    // width, so 0%/100% land it flush with each edge.
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
  const { file, tracking } = audio;
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
      const trackingIsOn =
        typeof tracking === 'undefined'
          ? S.prefs.xulsword.audio.tracking
          : tracking;
      if (trackingIsOn) {
        activeItems.forEach((item) => {
          getRootNode()
            .querySelectorAll(`div.sb span[data-id~="${item.id}"]`)
            .forEach((e) => {
              const el = e as HTMLElement;
              doHighlight(el, item, currentTime, xulswordState);
              CurrentActiveIds.add(item.id);
              // Scrolling with the current UI is not nice. Until the player can
              // be a static dispay, it's otherwise possible to block the user
              // where audio cannot be stopped! Also the scrolling causes
              // activated input elements to instantly deactivate annoyingly.
            });
        });
      }
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
  const player: HTMLAudioElement | undefined = getRootNode()
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
  const { settings } = timing;
  const { level, separators } = settings;

  // Work on a copy, since timing is React state which must not be modified.
  const allTimes: ZoneTimingEntry[] = timing.times.map((t) => ({
    ...t,
    dataId: t.id,
  }));

  // Text having these classes is ignored during phrase splitting.
  const skipClass = ['versenum', 'cr', 'fn', 'un'];

  // Identify and isolate container zones (currently verses).
  // TODO!! Support more than just Bible text.
  const zones = divElement.querySelectorAll(':scope > .vs');

  // Titles that are read aloud get their own spans, so the zones below are
  // matched against the rest of the timing entries.
  addTitleTimingSpans(divElement, Array.from(zones), allTimes);
  const times = allTimes.filter((t) => !parseTitleID(t.id));

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

    const zoneID = getZoneID(zone);

    let { zoneid } = parseTimingID(times[timingIndex].id);
    if (zoneid && zoneid !== zoneID) {
      const [zoneVerseStart, zoneVerseEnd] = verseRange(zoneID);
      if (zoneVerseEnd < verseRange(zoneid)[0]) return;
      while (zoneVerseStart > verseRange(zoneid)[1]) {
        timingIndex++;
        if (timingIndex >= times.length) return;
        ({ zoneid } = parseTimingID(times[timingIndex].id));
      }
      // The text may unexpectedly combine multiple verses into a single verse
      // range (eg. 8-9) while the timing file still lists each verse
      // separately. So combine those timing entries to match the text.
      if (zoneID.includes('-') && zoneid !== zoneID) {
        combineTimingZones(times, timingIndex, zoneID, level);
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
        // Completely skip these classes (don't map their text content), as
        // well as titles that are not verse text.
        if (
          skipClass.some((c) => node.classList.contains(c)) ||
          isNonCanonicalTitle(node)
        ) {
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
      level === 'phrase' &&
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
        // phrases of the verse.
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

// Returns the first and last verse numbers of a zoneid (eg. 8 or 8-9), or
// NaN if zoneid has none.
function verseRange(zoneid: string | undefined): [number, number] {
  if (!zoneid) return [NaN, NaN];
  return [
    Number(zoneid.replace(/^(\d+).*?$/, '$1')),
    Number(zoneid.replace(/^.*?(\d+)$/, '$1')),
  ];
}

// Like verseRange, but a zoneid having no verses is unbounded.
function boundedVerseRange(zoneid: string | undefined): [number, number] {
  const [v1, v2] = verseRange(zoneid);
  return [Number.isNaN(v1) ? -Infinity : v1, Number.isNaN(v2) ? Infinity : v2];
}

// Returns the verse number or verse range (eg. 8-9) of a zone.
function getZoneID(zone: Element): string {
  // The verse number is normally a direct child of the zone, but poetry
  // lines (eg. rendered from OSIS <l>/<lg> markup as <div class="line">)
  // wrap the zone's content in their own divs, pushing it down to a
  // grandchild or deeper. Search all descendants rather than assuming a
  // fixed depth.
  return zone.querySelector('.versenum')?.textContent.trim() ?? '';
}

// The kinds of title, named for their timing file prefix (see TitleTagRE).
// Introduction main titles (\imt) have no timing prefix here, but must not be
// taken for main titles.
type TitleKind = 's' | 'mt' | 'd' | 'sp' | 'is' | 'imt';

// Returns the kind of title of a title timing id (see parseTimingFile), or
// null if id is not a title's.
function parseTitleID(id: string): TitleKind | null {
  const [prefix, tag] = id.split('_');
  const m = prefix === 'title' ? tag?.match(TitleTagRE) : null;
  return m ? (m[1] as TitleKind) : null;
}

const HeadingSelector = 'h1, h2, h3, h4, h5, h6';

// Returns the kind of a title element, or null if el is not a title. Titles
// are heading elements of class head1 to head4 (LibSword renders every title
// within a verse as h1, whatever its level). Other classes come from the OSIS
// title's type and subType, which give its kind.
function getTitleKind(el: Element): TitleKind | null {
  if (!el.matches(HeadingSelector)) return null;
  const c = el.classList;
  if (![1, 2, 3, 4].some((n) => c.contains(`head${n}`))) return null;
  if (c.contains('x-introduction')) return c.contains('main') ? 'imt' : 'is';
  if (c.contains('main')) return 'mt';
  if (c.contains('psalm')) return 'd';
  if (c.contains('x-speaker')) return 'sp';
  return 's';
}

// Titles must never be inside a verse's synchronization span, unless they are
// canonical, in which case they are just verse text.
function isNonCanonicalTitle(node: Node): boolean {
  return (
    node instanceof Element &&
    !!getTitleKind(node) &&
    !node.classList.contains('canonical')
  );
}

// Returns true if node is or contains a title that is not verse text.
function containsNonCanonicalTitle(node: Node): boolean {
  return (
    node instanceof Element &&
    (isNonCanonicalTitle(node) ||
      Array.from(node.querySelectorAll(HeadingSelector)).some((h) =>
        isNonCanonicalTitle(h),
      ))
  );
}

function createSyncSpan(doc: Document, timingItem: ZoneTimingEntry) {
  const span = doc.createElement('span');
  span.className = 'verse-sync';
  span.setAttribute('data-start', timingItem.start.toString());
  span.setAttribute('data-id', timingItem.dataId);
  return span;
}

/**
 * Wraps the content of each title element that is read aloud in its own
 * synchronization span. Each title timing entry is applied to the next title
 * element of its kind (see getTitleKind), but only one located between the
 * verses of the timing entries surrounding it, so that any titles which are
 * not read aloud are passed over. Canonical titles within a zone are part of the zone's
 * text, so they are never matched. Titles outside of zones are not verse text,
 * so canonical ones there (such as preverse psalm titles) are matched.
 */
function addTitleTimingSpans(
  divElement: HTMLDivElement,
  zones: Element[],
  times: ZoneTimingEntry[],
) {
  // Find the candidate titles and where each is located relative to the
  // verses: a title within a zone is at that zone's verse(s), while a title
  // between zones is half a verse before the following zone (or after the
  // preceding zone, if none follows).
  const zoneSet = new Set(zones);
  type Title = { title: Element; kind: TitleKind; range: [number, number] };
  const titles: Title[] = [];
  let zone: Element | null = null;
  let zoneRange: [number, number] = [-Infinity, Infinity];
  let between: Title[] = [];
  for (const el of divElement.querySelectorAll(
    `:scope > .vs, ${HeadingSelector}`,
  )) {
    const kind = getTitleKind(el);
    if (zoneSet.has(el)) {
      zone = el;
      zoneRange = boundedVerseRange(getZoneID(el));
      const v = zoneRange[0] - 0.5;
      between.forEach((t) => (t.range = [v, v]));
      between = [];
    } else if (
      kind &&
      // Introductions are hidden, so are never read with the text.
      !el.closest('.introtext')
    ) {
      if (zone?.contains(el)) {
        if (isNonCanonicalTitle(el))
          titles.push({ title: el, kind, range: zoneRange });
      } else {
        const v = zoneRange[1] + 0.5;
        const t: Title = {
          title: el,
          kind,
          range: zone ? [v, v] : [-Infinity, Infinity],
        };
        titles.push(t);
        between.push(t);
      }
    }
  }

  let nextTitle = 0;
  times.forEach((entry, i) => {
    const kind = parseTitleID(entry.id);
    if (!kind) return;

    // The verses between which this title is read.
    const prev = times
      .slice(0, i)
      .reverse()
      .find((t) => !parseTitleID(t.id));
    const next = times.slice(i + 1).find((t) => !parseTitleID(t.id));
    const first = prev
      ? boundedVerseRange(parseTimingID(prev.id).zoneid)[0]
      : -Infinity;
    const last = next
      ? boundedVerseRange(parseTimingID(next.id).zoneid)[1]
      : Infinity;

    const find = (kinds: TitleKind[]) =>
      titles.findIndex(
        (t, j) =>
          j >= nextTitle &&
          t.range[0] <= last &&
          t.range[1] >= first &&
          kinds.includes(t.kind),
      );
    let index = find([kind]);
    // The kind of a title element may not reflect the SFM marker it was
    // labeled by (eg. some timing files label \d psalm titles as s, and some
    // \s2 titles are rendered as speaker titles), so an s title may also be
    // any other heading within the text.
    if (index === -1 && kind === 's') index = find(['d', 'sp']);
    if (index === -1) return;
    nextTitle = index + 1;

    const { title } = titles[index];
    const span = createSyncSpan(divElement.ownerDocument, entry);
    while (title.firstChild) span.appendChild(title.firstChild);
    title.appendChild(span);
  });
}

/**
 * Modifies the times array in place, combining the consecutive entries
 * beginning at startIndex, whose zones all fall within the verse range zoneID
 * (eg. separate entries for verses 8 and 9 when the text has 8-9), into
 * entries for zoneID itself. At verse level the entries become a single entry
 * spanning all of them. At phrase level every entry is kept, but the phrases
 * of each later verse are renumbered to follow those of the verse before it,
 * so each segment is still placed as before. Each entry's dataId keeps the
 * timing file id(s) so the highlighter still finds the spans.
 */
function combineTimingZones(
  times: ZoneTimingEntry[],
  startIndex: number,
  zoneID: string,
  level: TimingSettings['level'],
) {
  const [first, last] = verseRange(zoneID);
  let endIndex = startIndex;
  while (endIndex < times.length) {
    const [v1, v2] = verseRange(parseTimingID(times[endIndex].id).zoneid);
    if (!(v1 >= first && v2 <= last)) break;
    endIndex++;
  }
  const entries = times.slice(startIndex, endIndex);
  if (!entries.length) return;

  if (level === 'verse') {
    times.splice(startIndex, entries.length, {
      start: Math.min(...entries.map((e) => e.start)),
      end: Math.max(...entries.map((e) => e.end)),
      id: [parseTimingID(entries[0].id).level, zoneID].join('_'),
      dataId: entries.map((e) => e.dataId).join(' '),
      additionalSeparators: Array.from(
        new Set(entries.map((e) => e.additionalSeparators).join('')),
      ).join(''),
    });
    return;
  }

  let lastZoneid = '';
  let phraseOffset = 0;
  let maxPhrase = 0;
  entries.forEach((entry) => {
    const { level: lev, zoneid, phrase, word } = parseTimingID(entry.id);
    if (zoneid !== lastZoneid) {
      phraseOffset = maxPhrase;
      lastZoneid = zoneid ?? '';
    }
    const newPhrase = phrase + phraseOffset;
    maxPhrase = Math.max(maxPhrase, newPhrase);
    entry.id = [lev, zoneID, numberToPhrase(newPhrase), word !== -1 ? word : '']
      .filter(Boolean)
      .join('_');
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

// Returns true if a title that is not verse text lies among the siblings
// between span and target.
function nonCanonicalTitleBetween(span: HTMLElement, target: Node): boolean {
  for (let n = span.nextSibling; n && n !== target; n = n.nextSibling) {
    if (containsNonCanonicalTitle(n)) return true;
  }
  return false;
}

// Elements whose text is split into sync spans rather than being moved whole
// into a single span (see nearestBlockAncestor).
const BlockTags = ['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];

/**
 * Finds the nearest block container of a node: either the zone itself,
 * or the closest ancestor block element (eg. a poetry stanza rendered from an
 * OSIS <div> milestone, or a canonical title rendered as <h1>, which is a
 * descendant of the zone but wraps a whole run of lines/text). Text nodes are
 * split into sync spans relative to this container, the same way they would
 * be relative to the zone, so that a block's text is not swallowed whole by a
 * single timing entry.
 */
function nearestBlockAncestor(parent: Node, zone: Element): Element {
  let node: Node | null = parent;
  while (node && node !== zone) {
    if (node instanceof HTMLElement && BlockTags.includes(node.tagName))
      return node;
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
  timingItem: ZoneTimingEntry,
  claimedContainers: Set<Node>,
) {
  const doc = zone.ownerDocument;

  // A single timing segment's text may cross more than one block container
  // (eg. from the end of one poetry-line div into the next), since segment
  // boundaries are computed from the zone's flat text without regard to div
  // boundaries. A DOM node can only live in one parent, so each block
  // container touched by this segment gets its own sync span (all sharing
  // the same data-id/data-start; the highlighting code already matches on
  // all spans with a given data-id). A data-id may list several space
  // separated timing ids (see combineTimingZones).
  const spans = new Map<
    Element,
    { span: HTMLElement; firstInserted: boolean }
  >();
  function spanFor(container: Element, target: Node) {
    let entry = spans.get(container);
    // A title that is not verse text must not be pulled into the span (see
    // moveUnclaimedSiblings), so if one lies between the span and the next
    // piece it would claim, the segment continues in a new span.
    if (
      !entry ||
      (entry.firstInserted && nonCanonicalTitleBetween(entry.span, target))
    ) {
      entry = { span: createSyncSpan(doc, timingItem), firstInserted: false };
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

      const entry = spanFor(blockAncestor, container);
      const { span } = entry;
      if (!entry.firstInserted) {
        blockAncestor.replaceChild(span, container);
        entry.firstInserted = true;
      } else {
        moveUnclaimedSiblings(span, container);
      }
      if (span !== container) span.appendChild(container);
      return;
    }

    const entry = spanFor(blockAncestor, map.node);
    const { span } = entry;

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

  // Only the LAST setting in the timing file is effective. This allows default
  // config to be inserted at the top of each file, from HTTP header data.
  const settings = {
    level:
      (lines
        .reverse()
        .find((l) => l.startsWith('\\level'))
        ?.replace(/^\\level\s+(\S+)\s*$/, '$1') as 'phrase' | 'verse') ??
      ('phrase' as const),
    separators:
      lines
        .reverse()
        .find((l) => l.startsWith('\\separators'))
        ?.replace(/^\\separators[ ]+(.*?)[ ]*$/, '$1') ??
      C.DefaultAudioTimingSeparators,
  };
  // If all timing id's are only verse numbers or verse ranges (or titles),
  // then level must be 'verse'.
  if (lines.every((l) => /\s+([-\d]+|(s|mt|d|sp|is)\d+)$/.test(l)))
    settings.level = 'verse';
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

    // Titles that are read aloud have no verse id, since they may occur
    // between verses. They are identified by their kind and order instead
    // (see TitleTagRE).
    if (TitleTagRE.test(parts[2] ?? '')) {
      return {
        start,
        end,
        id: ['title', parts[2]].join('_'),
        additionalSeparators: '',
      };
    }

    // Get the xulsword timing id. The xulsword timing id is different than
    // the id in the timing file, but easier to use. Based on SIL timing file
    // documentation, we must support all expected possibilities
    let zoneid = '';
    let phrase = '';
    let word = '';
    let additionalSeparators = ''; // ids may include additional separators
    if (level === 'phrase' && parts.length === 2) {
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
      if (!phrase && level === 'phrase') phrase = 'a';
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
      const tcheader = response.headers.get('X-Timing-Config');
      const timingConfig = tcheader ? decodeURIComponent(tcheader) : '';
      const tt = fileContent.trim();
      return tt !== 'no-timing-file'
        ? [timingConfig.trim(), tt].filter(Boolean).join('\n')
        : '';
    }
  } catch (error) {
    log.error(`Error getting timing file: ${error}`);
  }

  return '';
}

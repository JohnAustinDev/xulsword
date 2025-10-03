import React from 'react';
import ReactDOM from 'react-dom';
import { ProgressBar } from '@blueprintjs/core';
import Subscription from '../../../subscription.ts';
import { diff, randomID, sanitizeHTML, stringHash } from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import {
  getStatePref,
  setStatePref,
  libswordImgSrc,
  printRefs,
  doUntilDoneAsync,
} from '../../common.ts';
import log from '../../log.ts';
import analytics from '../../analytics.ts';
import RenderPromise, {
  RenderPromiseComponent,
  RenderPromiseState,
} from '../../renderPromise.ts';
import Grid, {
  Column,
  Columns,
  Row,
  Rows,
} from '../../components/libxul/grid.tsx';
import Groupbox from '../../components/libxul/groupbox.tsx';
import Checkbox from '../../components/libxul/checkbox.tsx';
import SelectVK from '../../components/libxul/selectVK.tsx';
import {
  handler as handlerH,
  vkSelectHandler as vkSelectHandlerH,
  validPassage,
  bibleChapterText,
} from './printPassageH.tsx';
import '../../libsword.css';
import '../../components/atext/atext.css';
import './printPassage.css';

import type { ReactElement } from 'react';
import type S from '../../../defaultPrefs.ts';
import type { OSISBookType, V11nType } from '../../../type.ts';
import type { AtextPropsType } from '../atext/atext.tsx';
import type { PrintOptionsType } from '../../controller.tsx';
import type { XulProps } from '../../components/libxul/xul.tsx';

// The PrintPassage component utilizes state prefs to render a series of Bible
// chapters into the printContainerRef (provided via a prop). Custom settings
// provided to customSettingsRef allow users to select text options for print.

// TODO: As of 11/22 @page {@bottom-center {content: counter(page);}} does not work

// 0=none, 1=checkbox, 2=placeholder
const switches = [
  [
    [1, 1, 'headings', 'menu.view.headings'],
    [1, 1, 'footnotes', 'menu.view.footnotes'],
    [1, 1, 'usernotes', 'menu.view.usernotes'],
    [1, 1, 'crossrefs', 'menu.view.crossrefs'],
    [1, 1, 'crossrefsText', 'crossrefs.withText.label'],
    [0, 2, '' as never, ''],
  ],
  [
    [1, 1, 'introduction', 'introduction.label'],
    [1, 1, 'versenums', 'menu.view.versenums'],
    [1, 1, 'redwords', 'menu.view.redwords'],
    [1, 1, 'dictlinks', 'menu.view.dictlinks'],
    [2, 1, 'hebcantillation', 'menu.options.hebCant'],
    [0, 1, 'hebvowelpoints', 'menu.options.hebVowel'],
  ],
] as const;
if (Build.isWebApp) {
  (switches[0] as any)[2] = [0, 0, 'usernotes', 'menu.view.usernotes'];
}

export type PrintPassageProps = XulProps;

const notStatePrefDefault = {
  progress: -1 as number,
};

export type PrintPassageState = typeof S.prefs.printPassage &
  typeof notStatePrefDefault &
  RenderPromiseState;

export default class PrintPassage
  extends React.Component<PrintPassageProps, PrintPassageState>
  implements RenderPromiseComponent
{
  pagebuttons: React.RefObject<HTMLDivElement>;

  handler: typeof handlerH;

  vkSelectHandler: typeof vkSelectHandlerH;

  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLDivElement>;

  componentInstanceID: string;

  static renderingKeys: string[] = [];

  constructor(props: PrintPassageProps) {
    super(props);

    this.loadingRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);

    const s: PrintPassageState = {
      renderPromiseID: 0,
      ...notStatePrefDefault,
      ...(getStatePref('prefs', 'printPassage') as typeof S.prefs.printPassage),
    };
    if (s.chapters) {
      const { chapter, lastchapter } = s.chapters;
      if (chapter && !lastchapter) s.chapters.lastchapter = chapter;
    }
    const vc = validPassage(s.chapters, this.renderPromise);
    if (!this.renderPromise.waiting()) s.chapters = vc;
    this.state = s;

    this.pagebuttons = React.createRef();
    this.componentInstanceID = randomID();

    this.handler = handlerH.bind(this);
    this.vkSelectHandler = vkSelectHandlerH.bind(this);
  }

  componentDidMount() {
    const { renderPromise } = this;
    const state = this.state as PrintPassageState;
    setStatePref('prefs', 'printPassage', null, state);
    renderPromise.dispatch();
    this.forceUpdate(); // for portal DOM target
  }

  componentDidUpdate(
    _prevProps: PrintPassageProps,
    prevState: PrintPassageState,
  ) {
    const { componentInstanceID, renderPromise } = this;
    const state = this.state as PrintPassageState;
    const tdiv = printRefs.printContainerRef.current;
    const { checkbox, chapters, progress } = state;

    const valid = validPassage(chapters, renderPromise);
    // An invalid passage must be updated to a valid one.
    if (!renderPromise.waiting() && diff(chapters, valid)) {
      this.setState({ chapters: valid });
    } else if (chapters) {
      setStatePref('prefs', 'printPassage', prevState, state);
      const { vkMod, book, chapter, lastchapter, v11n } = chapters;
      if (vkMod && lastchapter && tdiv) {
        // Insure controller has current direction and printDisabled settings.
        Subscription.publish.setControllerState(
          {
            print: {
              printDisabled: progress !== -1,
              direction: G.Tab[vkMod].direction || 'auto',
            } as PrintOptionsType,
          },
          false,
        );

        // Insure current selection will be rendered to tdiv.
        const show: AtextPropsType['show'] & {
          introduction: boolean;
          crossrefsText: boolean;
        } = { ...checkbox, strongs: false, morph: false };
        if (Build.isWebApp) show.usernotes = false;
        const renderkey = stringHash(
          vkMod,
          book,
          chapter,
          lastchapter,
          v11n,
          show,
          componentInstanceID,
        );
        if (tdiv.dataset.renderkey !== renderkey) {
          this.renderChapters(
            renderkey,
            vkMod,
            book,
            chapter,
            lastchapter,
            v11n,
            show,
          ).catch((er) => log.error(er));
        }
      }
    }
    renderPromise.dispatch();
  }

  async renderChapters(
    renderkey: string,
    vkMod: string,
    book: OSISBookType,
    chapter: number,
    lastchapter: number,
    v11n: V11nType | null,
    show: AtextPropsType['show'] & {
      introduction: boolean;
      crossrefsText: boolean;
    },
  ) {
    log.verbose(`${renderkey} PrintPassage renderChapters is starting...`);
    let div = printRefs.printContainerRef.current;
    if (!div) return;

    sanitizeHTML(div, '');
    // All async opperations below will self terminate if div's renderkey is
    // changed as React updates the DOM.
    div.dataset.renderkey = renderkey;

    const settings = {
      module: vkMod,
      show,
      ilModule: undefined,
      ilModuleOption: [],
      modkey: '',
      place: {
        footnotes: 'notebox',
        crossrefs: 'notebox',
        usernotes: 'notebox',
      } as const,
    };

    const renderChaps: Array<[OSISBookType, number]> = [];
    for (let ch = chapter; ch <= lastchapter; ch += 1) {
      renderChaps.push([book, ch]);
    }

    if (!renderChaps.length) {
      printRefs.setPages();
      return 0;
    }

    // Don't report the many chapter, verse and glossary reads to
    // analytics!
    analytics.stop();

    // Show the progress bar.
    Subscription.publish.setControllerState(
      {
        print: { printDisabled: true } as PrintOptionsType,
      },
      false,
    );
    this.setState({ progress: 0 });
    PrintPassage.renderingKeys.push(renderkey);

    // Render each chapter successively to the DOM, as long as the renderKey
    // remains unchanged. Rendering stops when the number of pages exceeds
    // C.UI.Print.maxPages pages, or all chapters have been added to the DOM.
    let chIndex = 0;
    for (; div && chIndex < renderChaps.length; chIndex++) {
      const [book, chapter] = renderChaps[chIndex];
      let r = '';
      try {
        r = await doUntilDoneAsync(async (renderPromise) => {
          const r2 = new Promise((resolve2, reject2) => {
            setTimeout(() => {
              if (
                printRefs.printContainerRef.current?.dataset.renderkey !==
                renderkey
              )
                reject2(
                  new Error(
                    `${renderkey} Chapter rendering was interrupted (${
                      printRefs.printContainerRef.current?.dataset.renderkey
                    } != ${renderkey})`,
                  ),
                );
              const chapterText = bibleChapterText(
                {
                  ...settings,
                  location: { book, chapter, v11n },
                },
                renderPromise,
              );
              if (!renderPromise.waiting()) {
                this.setState({
                  progress: chIndex / renderChaps.length,
                });
                return resolve2(chapterText);
              }
              return resolve2('waiting'); // Not returned by doUntilDoneAsync
            }, 1);
          }) as Promise<string>;
          return await r2;
        }, printRefs.printContainerRef);
      } catch (er: any) {
        log.verbose(er.message);
        break;
      } finally {
        div = printRefs.printContainerRef.current;
      }
      if (div?.dataset.renderkey !== renderkey) break;
      log.verbose(`${renderkey} Loading chapter to DOM: ${chapter}`);
      div.innerHTML += sanitizeHTML(r);
      libswordImgSrc(div);
      if (Math.floor(div.scrollWidth / div.clientWidth) > C.UI.Print.maxPages) {
        log.info(
          `${renderkey} Stopping chapter rendering at ${chIndex}/${renderChaps.length} chapters.`,
        );
        break;
      }
    }

    if (div) {
      log.verbose(
        `${renderkey} Finished rendering with ${Math.floor(
          div.scrollWidth / div.clientWidth,
        )} pages in DOM div.`,
      );
    }

    const { renderingKeys } = PrintPassage;
    const index = renderingKeys.indexOf(renderkey);
    if (index !== -1) renderingKeys.splice(index, 1);
    if (index === -1 || !renderingKeys.length) {
      this.setState({ progress: -1 });
      Subscription.publish.setControllerState(
        {
          print: {
            printDisabled: false,
          } as PrintOptionsType,
        },
        false,
      );
      printRefs.setPages();
      analytics.start();
    }

    return chIndex === renderChaps.length ? chIndex : 0;
  }

  render() {
    const state = this.state as PrintPassageState;
    const { checkbox, chapters, progress } = state;
    const { loadingRef, renderPromise, handler, vkSelectHandler } = this;
    const vkMod = chapters?.vkMod;
    if (!vkMod || !chapters) return null;

    const { lang } = G.Tab[vkMod];
    const isHebrew = lang && /^heb?$/i.test(lang);
    const tr = isHebrew ? 1 : 0;

    const { book: b, chapter: c1, lastchapter: c2 } = chapters;
    const keySelectVK = [vkMod, b, c1, c2].join('.');

    analytics.setInfoOverride('printPassage', {
      event: 'print',
      module: vkMod,
      locationvk: `${chapters.book} ${chapters.chapter}-${chapters.lastchapter}`,
    });

    return (
      <>
        {printRefs.customSettingsRef.current &&
          ReactDOM.createPortal(
            <>
              <Groupbox
                domref={loadingRef}
                className="passage-selector"
                caption={GI.i18n.t('', renderPromise, 'menu.printPassage')}
              >
                <SelectVK
                  id="chapters"
                  key={keySelectVK}
                  initialVK={{ ...chapters, vkMod }}
                  options={{
                    verses: [],
                    lastverses: [],
                    vkMods: 'Texts',
                  }}
                  language
                  description
                  onSelection={vkSelectHandler}
                />
                {progress !== -1 && (
                  <ProgressBar
                    value={undefined}
                    intent="primary"
                    animate
                    stripes
                  />
                )}
              </Groupbox>
              <Groupbox
                className="text-options"
                caption={GI.i18n.t('', renderPromise, 'include.label')}
              >
                <Grid>
                  <Rows>
                    {switches[0]
                      .filter((r) => r[tr] > 0)
                      .map((c) => (
                        <Row key={c.join('.')} />
                      ))}
                  </Rows>
                  <Columns>
                    {switches.map((cols) => (
                      <Column key={[tr, ...cols.map((c) => c[2])].join('.')}>
                        {cols.map((c) => {
                          const key = [c[tr], c[2]].join('.');
                          let cb: ReactElement | null = null;
                          if (c[tr] === 1) {
                            cb = (
                              <Checkbox
                                key={key}
                                id={c[2]}
                                label={GI.i18n.t('', renderPromise, c[3])}
                                checked={checkbox[c[2]]}
                                disabled={
                                  c[2] === 'crossrefsText' &&
                                  !checkbox.crossrefs
                                }
                                onChange={handler}
                              />
                            );
                          } else if (c[tr] === 2) {
                            cb = <div key={key} />;
                          }
                          return cb;
                        })}
                      </Column>
                    ))}
                  </Columns>
                </Grid>
              </Groupbox>
            </>,
            printRefs.customSettingsRef.current,
          )}
      </>
    );
  }
}

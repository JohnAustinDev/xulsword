/* eslint-disable @typescript-eslint/no-misused-promises */
import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { ProgressBar } from '@blueprintjs/core';
import {
  clone,
  diff,
  drop,
  sanitizeHTML,
  stringHash,
} from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import RenderPromise from '../../renderPromise.ts';
import log from '../../log.ts';
import {
  i18nApplyOpts,
  dString,
  iframeAutoHeight,
  moduleIncludesStrongs,
  windowArguments,
} from '../../common.tsx';
import Popup from '../../components/popup/popup.tsx';
import {
  popupParentHandler as popupParentHandlerH,
  popupHandler as popupHandlerH,
  PopupParentInitState,
} from '../../components/popup/popupParentH.ts';
import Button from '../../components/libxul/button.tsx';
import {
  delayHandler,
  xulPropTypes,
  addClass,
} from '../../components/libxul/xul.tsx';
import { Box, Hbox, Vbox } from '../../components/libxul/boxes.tsx';
import Groupbox from '../../components/libxul/groupbox.tsx';
import Label from '../../components/libxul/label.tsx';
import Menulist from '../../components/libxul/menulist.tsx';
import Radio from '../../components/libxul/radio.tsx';
import Grid, {
  Column,
  Columns,
  Row,
  Rows,
} from '../../components/libxul/grid.tsx';
import Textbox from '../../components/libxul/textbox.tsx';
import Spacer from '../../components/libxul/spacer.tsx';
import Stack from '../../components/libxul/stack.tsx';
import Dialog from '../../components/libxul/dialog.tsx';
import ModuleMenu from '../../components/libxul/modulemenu.tsx';
import handlerH, {
  search,
  hilightStrongs,
  formatResult,
  lexicon,
  strongsCSS,
} from './searchH.tsx';
import './search.css';

import type {
  BookGroupType,
  SearchType,
  WindowDescriptorType,
} from '../../../type.ts';
import type { SearchResult } from '../../../servers/components/libsword.ts';
import type S from '../../../defaultPrefs.ts';
import type {
  RenderPromiseState,
  RenderPromiseComponent,
} from '../../renderPromise.ts';
import type {
  PopupParent,
  PopupParentState,
} from '../../components/popup/popupParentH.ts';
import type { XulProps } from '../../components/libxul/xul.tsx';

const propTypes = {
  initialState: PropTypes.object.isRequired,
  descriptor: PropTypes.object,
  onlyLucene: PropTypes.bool,
  ...xulPropTypes,
};

export type SearchProps = {
  initialState: SearchType;
  descriptor?: WindowDescriptorType;
  onlyLucene?: boolean;
} & XulProps;

const defaultState = {
  module: '' as string, // search module
  searchtext: '' as string, // search text
  searchtype: 'SearchExactText' as SearchType['type'], // type of search to do
  scoperadio: 'all' as (typeof ScopeRadioOptions)[number], // scope radio value
  scopeselect: 'gospel' as
    | BookGroupType
    | (typeof ScopeSelectOptions)[number]
    | string, // scope select value
  moreLess: true as boolean, // more / less state
  displayModule: '' as string, // current module for displaying search results
  results: null as SearchResult | null, // count and page-result are returned at different times
  pageindex: 0 as number, // first results index to show
  progress: -1 as number,
  progressLabel: '' as string, // changing progress label
  indexing: false as boolean, // indexer is running
  searching: {
    module: '',
    search: '',
    scopes: [] as string[],
    type: 0,
    flags: 0,
  },
  showHelp: null as React.JSX.Element | null, // for web app to show help in div rather than window
};

const ScopeRadioOptions = ['all', 'book', 'ot', 'nt', 'other'] as const;

const ScopeSelectOptions = [
  'pentateuch',
  'history',
  'wisdom',
  'prophets',
  'gospel',
  'letters',
] as const;

const Scopemap = {
  pentateuch: 'Gen-Deut',
  history: 'Josh-Esth',
  wisdom: 'Job-Song',
  prophets: 'Isa-Mal',
  gospel: 'Matt-John',
  letters: 'Acts-Rev',
};

// These state properties will not be persisted if xulsword is closed.
const noPersist = ['results', 'pageindex', 'progress', 'progressLabel'].concat(
  Object.keys(PopupParentInitState),
) as Array<
  | keyof typeof PopupParentInitState
  | 'results'
  | 'pageindex'
  | 'progress'
  | 'progressLabel'
>;

let reMountState = null as null | SearchState;

export type SearchState = PopupParentState &
  RenderPromiseState &
  typeof defaultState;

export default class Search
  extends React.Component
  implements PopupParent, RenderPromiseComponent
{
  static propTypes: typeof propTypes;

  handler: typeof handlerH;

  popupParentHandler: typeof popupParentHandlerH;

  popupHandler: typeof popupHandlerH;

  popupDelayTO: PopupParent['popupDelayTO'];

  popupUnblockTO: PopupParent['popupUnblockTO'];

  resref: React.RefObject<HTMLDivElement>;

  lexref: React.RefObject<HTMLDivElement>;

  destroy: Array<() => void>;

  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLDivElement>;

  constructor(props: SearchProps) {
    super(props);

    const { initialState } = props;

    this.loadingRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);

    const abible = G.Tabs.find((t) => t.type === C.BIBLE);

    const s: SearchState = {
      ...PopupParentInitState,
      ...defaultState,
      module: initialState.module,
      searchtext: initialState.searchtext,
      searchtype: initialState.type,
      displayModule: initialState.module,
      renderPromiseID: 0,
    };
    // Adjustments for special startup situations
    if (!(s.module in G.Tab)) s.module = abible?.module || '';
    if (initialState?.scope) {
      s.scoperadio = 'other';
      s.scopeselect = initialState.scope as any;
    } else {
      s.scopeselect = Scopemap[ScopeSelectOptions[0]];
    }
    if (
      Build.isElectronApp &&
      !s.moreLess &&
      s.module &&
      !GI.LibSword.luceneEnabled(true, this.renderPromise, s.module)
    ) {
      s.moreLess = true;
    }

    const pstate = windowArguments('pstate') as SearchState;
    this.state = Build.isElectronApp ? reMountState || pstate || s : s;

    this.updateResults = this.updateResults.bind(this);
    this.handler = handlerH.bind(this);
    this.popupParentHandler = popupParentHandlerH.bind(this);
    this.popupHandler = popupHandlerH.bind(this);

    this.resref = React.createRef();
    this.lexref = React.createRef();
    this.destroy = [];
  }

  componentDidMount() {
    const { renderPromise } = this;
    const state = this.state as SearchState;
    const { module } = state;
    this.destroy.push(
      window.IPC.on('progress', (prog: number, id?: string) => {
        if (id === 'search.indexer') {
          this.setState({ progressLabel: '', progress: prog });
        }
      }),
    );
    // React StrictMode causes components to be mounted twice, but we don't
    // want the search chain running twice.
    if (module) {
      delayHandler(
        globalThis,
        () => search(this).catch((er) => log.error(er)),
        [],
        50,
        'afterMountSearch',
      );
    }
    renderPromise.dispatch();
  }

  componentDidUpdate(_prevProps: any, prevState: SearchState) {
    const { renderPromise } = this;
    const state = this.state as SearchState;
    const { descriptor } = this.props as SearchProps;
    if (Build.isElectronApp) {
      reMountState = clone({
        ...state,
        elemdata: null,
        popupParent: null,
        showHelp: null,
      });
    }
    // Save changed window prefs (plus initials to obtain complete state).
    const persistState = drop(state, noPersist) as Omit<
      SearchState,
      (typeof noPersist)[number]
    >;
    const psx = persistState as any;
    const isx = defaultState as any;
    if (
      descriptor &&
      diff(
        { ...prevState, popupParent: null },
        { ...persistState, popupParent: null },
      )
    ) {
      noPersist.forEach((p) => {
        psx[p] = isx[p];
      });
      G.Window.setComplexValue('pstate', { ...persistState, showHelp: null });
    }

    // Apply popup fade-in effect
    const { popupParent, elemdata } = state;
    if (popupParent && elemdata?.length) {
      popupParent.getElementsByClassName('npopup')[0]?.classList.remove('hide');
    }

    this.updateResults();
    iframeAutoHeight('.card'); // card height is not constrained
    renderPromise.dispatch();
  }

  componentWillUnmount() {
    this.destroy.forEach((d) => {
      d();
    });
  }

  updateResults() {
    const state = this.state as SearchState;
    const { displayModule, module, results, searchtext, searching, progress } =
      state;
    const { resref, lexref, renderPromise } = this;
    const res = resref !== null ? resref.current : null;
    if (res === null || !module) return;

    const isStrongsModule = moduleIncludesStrongs(displayModule, renderPromise);
    const resultsHtml = results ? stringHash(results.html) : '';
    if (!displayModule || !results) {
      sanitizeHTML(res, '');
    } else if (res.dataset.resultsHtml !== resultsHtml) {
      // clear dynamic CSS
      strongsCSS.added.forEach((r) => {
        if (r < strongsCSS.sheet.cssRules.length) {
          strongsCSS.sheet.deleteRule(r);
        }
      });
      strongsCSS.added = [];
      // build a page from results, module and pageindex
      if (isStrongsModule && searchtext.includes('lemma:')) {
        hilightStrongs(searchtext.match(/lemma:\s*\S+/g));
      }
      sanitizeHTML(res, results.html);
      formatResult(res, state, renderPromise);
      if (!renderPromise.waiting()) res.dataset.resultsHtml = resultsHtml;
    }

    const lex = lexref !== null ? lexref.current : null;
    const lexiconHtml = stringHash(searching);

    if (progress === -1 && res.dataset.lexiconHtml !== lexiconHtml) {
      // build a lexicon for the last search
      if (lex) {
        if (!displayModule || !results || !isStrongsModule) {
          sanitizeHTML(lex, '');
        } else {
          lexicon(lex, this, renderPromise).catch((er) => {
            log.error(er);
          });
        }
      }
      if (!renderPromise.waiting()) res.dataset.lexiconHtml = lexiconHtml;
    }
  }

  render() {
    const state = this.state as SearchState;
    const props = this.props as SearchProps;
    const {
      renderPromise,
      loadingRef,
      handler,
      popupHandler,
      popupParentHandler,
    } = this;
    const { initialState, onlyLucene } = props;
    const {
      module,
      searchtext,
      searchtype,
      scoperadio,
      scopeselect,
      results,
      moreLess,
      pageindex,
      progress,
      progressLabel,
      displayModule,
      popupParent,
      popupReset,
      gap,
      elemdata,
      indexing,
      showHelp,
    } = state;

    const searchTypes: Array<SearchType['type']> = [
      'SearchAnyWord',
      'SearchSimilar',
      'SearchExactText',
      'SearchAdvanced',
    ];

    const sos = ScopeSelectOptions.slice() as Array<SearchState['scopeselect']>;

    if (initialState.scope) sos.unshift(initialState.scope);
    C.SupportedBookGroups.forEach((bg) => {
      if (
        module &&
        !['ot', 'nt'].includes(bg) &&
        GI.getBooksInVKModule([], renderPromise, module).some((bk) => {
          const x = C.SupportedBooks[bg] as any;
          return x.includes(bk);
        })
      ) {
        sos.push(bg);
      }
    });

    const scopeOptions = sos.map((option) => {
      return (
        <option
          key={option}
          value={
            option in Scopemap
              ? Scopemap[option as keyof typeof Scopemap]
              : option
          }
        >
          {GI.i18n.exists(false, this.renderPromise, `${option}.label`)
            ? GI.i18n.t('', this.renderPromise, `${option}.label`)
            : option}
        </option>
      );
    });

    const location = G.Prefs.getComplexValue(
      'xulsword.location',
    ) as typeof S.prefs.xulsword.location;

    const searchindex =
      module && GI.LibSword.luceneEnabled(true, renderPromise, module);

    const count = results ? results.count : 0;
    const lasti =
      count - pageindex < C.UI.Search.resultsPerPage
        ? count
        : pageindex + C.UI.Search.resultsPerPage;
    let searchStatus = '';
    if (count > C.UI.Search.resultsPerPage) {
      searchStatus = i18nApplyOpts(
        GI.i18n.t('', renderPromise, 'searchStatusPage'),
        {
          v1: dString(pageindex + 1),
          v2: dString(lasti),
          v3: dString(count),
        },
      );
    } else {
      searchStatus = i18nApplyOpts(
        GI.i18n.t('', renderPromise, 'searchStatusAll'),
        {
          v1: dString(count),
        },
      );
    }

    return (
      <Vbox domref={loadingRef} {...addClass('search', props)}>
        {indexing && (
          <Dialog
            className="indexing-dialog"
            key="indexing"
            body={
              <Vbox pack="center" align="center">
                <Label
                  value={GI.i18n.t('', renderPromise, 'buildingIndex.label')}
                />
              </Vbox>
            }
          />
        )}

        {popupParent &&
          elemdata?.length &&
          ReactDOM.createPortal(
            <Popup
              className="hide"
              key={[gap, elemdata.length, popupReset].join('.')}
              elemdata={elemdata}
              gap={gap}
              onMouseMove={popupHandler}
              onPopupClick={popupHandler}
              onSelectChange={popupHandler}
              onMouseLeftPopup={popupHandler}
              onPopupContextMenu={popupHandler}
            />,
            popupParent,
          )}

        <Hbox pack="center">
          <Grid
            className={['search-grid', moreLess ? 'more' : 'less'].join(' ')}
          >
            <Columns>
              <Column width="min-content" />
              <Column width="min-content" />
            </Columns>
            <Rows>
              <Row>
                <Groupbox
                  id="searchTextGroup"
                  orient="horizontal"
                  align="center"
                >
                  <Hbox className="searchtextLabel" align="center">
                    <Label
                      control="searchtext"
                      value={`${GI.i18n.t('', renderPromise, 'searchtext.label')}:`}
                    />
                  </Hbox>

                  <Vbox className="searchtext">
                    <Textbox
                      id="searchtext"
                      value={searchtext}
                      title={GI.i18n.t('', renderPromise, 'searchbox.tooltip')}
                      maxLength="60"
                      onChange={handler}
                    />
                    <ModuleMenu
                      id="module"
                      value={module}
                      language
                      description
                      sortByLabel
                      onChange={handler}
                    />
                  </Vbox>
                  <Hbox className="searchtextButtons">
                    <Button
                      id="searchButton"
                      icon="search"
                      flex="1"
                      disabled={progress !== -1 || !module}
                      onClick={handler}
                    >
                      {GI.i18n.t('', renderPromise, 'menu.search')}
                    </Button>
                    <Button
                      id="helpButton"
                      className={showHelp ? 'open' : 'closed'}
                      icon={showHelp ? 'cross' : 'help'}
                      onClick={handler}
                    >
                      {showHelp}
                    </Button>
                    <Button id="moreLess" onClick={handler}>
                      {!moreLess && (
                        <Label
                          value={GI.i18n.t('', renderPromise, 'more.label')}
                        />
                      )}
                      {moreLess && (
                        <Label
                          value={GI.i18n.t('', renderPromise, 'less.label')}
                        />
                      )}
                    </Button>
                  </Hbox>
                </Groupbox>
              </Row>
              <Row>
                <Stack
                  className="search-type"
                  orient="horizontal"
                  align="stretch"
                >
                  <Groupbox
                    id="searchtype"
                    caption={GI.i18n.t('', renderPromise, 'searchType.label')}
                    orient="vertical"
                    onChange={handler}
                  >
                    {searchTypes
                      .filter((st) => !(onlyLucene && st === 'SearchExactText'))
                      .map((st) => (
                        <Radio
                          key={['type', st].join('.')}
                          name="type"
                          checked={searchtype === st}
                          value={st}
                          label={GI.i18n.t('', renderPromise, `${st}.label`)}
                          title={GI.i18n.t(
                            '',
                            renderPromise,
                            `${st}.description`,
                          )}
                        />
                      ))}
                  </Groupbox>
                  {!searchindex && !indexing && (
                    <>
                      <Vbox />
                      <Vbox align="center">
                        <Button
                          id="createIndexButton"
                          disabled={Build.isWebApp || progress !== -1}
                          onClick={handler}
                        >
                          {GI.i18n.t('', renderPromise, 'createIndex.label')}
                        </Button>
                      </Vbox>
                    </>
                  )}
                </Stack>
                <Groupbox
                  id="scoperadio"
                  caption={GI.i18n.t('', renderPromise, 'searchScope.label')}
                  onChange={handler}
                >
                  <Grid>
                    <Columns>
                      <Column width="min-content" />
                      <Column width="min-content" />
                    </Columns>
                    <Rows>
                      <Row>
                        <Radio
                          name="scope"
                          checked={scoperadio === 'all'}
                          value="all"
                          label={GI.i18n.t('', renderPromise, 'search.all')}
                        />
                        <Radio
                          name="scope"
                          checked={scoperadio === 'book'}
                          value="book"
                          label={GI.i18n.t(
                            '',
                            renderPromise,
                            'search.currentBook',
                          )}
                          disabled={!location?.book}
                        />
                      </Row>
                      <Row>
                        <Radio
                          name="scope"
                          checked={scoperadio === 'ot'}
                          value="ot"
                          label={GI.i18n.t('', renderPromise, 'search.ot')}
                        />
                        <Radio
                          name="scope"
                          checked={scoperadio === 'nt'}
                          value="nt"
                          label={GI.i18n.t('', renderPromise, 'search.nt')}
                        />
                      </Row>
                      <Row>
                        <div>
                          <Radio
                            name="scope"
                            checked={scoperadio === 'other'}
                            value="other"
                            label={`${GI.i18n.t('', renderPromise, 'search.groups')}:`}
                          />
                          <Menulist
                            id="scopeselect"
                            value={scopeselect}
                            options={scopeOptions}
                            disabled={scoperadio !== 'other'}
                            onChange={handler}
                          />
                        </div>
                      </Row>
                    </Rows>
                  </Grid>
                </Groupbox>
              </Row>
            </Rows>
          </Grid>
        </Hbox>

        <Hbox className="searchStatus" pack="start" align="center">
          <Box>
            <span>{searchStatus}</span>
          </Box>
          <Spacer flex="1" />
          {progress !== -1 && (
            <Hbox align="center">
              {progressLabel && <Label value={`${progressLabel}:`} />}
              <ProgressBar value={progress} />
            </Hbox>
          )}
        </Hbox>
        <Vbox className="result-container" flex="1">
          <Hbox className="result-parent" flex="1">
            <Vbox
              className="resultBox"
              pack="start"
              flex="1"
              data-context={displayModule}
              onMouseOut={popupParentHandler}
              onMouseOver={popupParentHandler}
              onMouseMove={popupParentHandler}
            >
              {module && G.Tab[module].type === C.BIBLE && (
                <div className="lexiconParent">
                  <ModuleMenu
                    id="displayModule"
                    value={displayModule}
                    types={[C.BIBLE]}
                    language
                    description
                    sortByLabel
                    disabled={!module || G.Tab[module].type !== C.BIBLE}
                    onChange={handler}
                  />
                  <span
                    id="lexiconResults"
                    ref={this.lexref}
                    onClick={handler}
                  />
                </div>
              )}
              <Spacer orient="horizontal" />
              <Vbox
                id="searchResults"
                pack="start"
                flex="8"
                domref={this.resref}
                onClick={handler}
              />
            </Vbox>
            {count > C.UI.Search.resultsPerPage && (
              <Vbox className="buttonBox">
                <Button
                  id="pagefirst"
                  icon="double-chevron-up"
                  disabled={progress !== -1}
                  onClick={handler}
                />
                <Spacer orient="vertical" flex="1" />
                <Button
                  id="pageprev"
                  icon="chevron-up"
                  disabled={progress !== -1}
                  onClick={handler}
                />
                <Button
                  id="pagenext"
                  icon="chevron-down"
                  disabled={progress !== -1}
                  onClick={handler}
                />
                <Spacer orient="vertical" flex="1" />
                <Button
                  id="pagelast"
                  icon="double-chevron-down"
                  disabled={progress !== -1}
                  onClick={handler}
                />
              </Vbox>
            )}
          </Hbox>
        </Vbox>
      </Vbox>
    );
  }
}
Search.propTypes = propTypes;

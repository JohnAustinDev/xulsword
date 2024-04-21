/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import ReactDOM from 'react-dom';
import { ProgressBar } from '@blueprintjs/core';
import {
  noAutoSearchIndex,
  clone,
  diff,
  drop,
  dString,
  sanitizeHTML,
} from '../../common.ts';
import C from '../../constant.ts';
import S from '../../defaultPrefs.ts';
import G from '../rg.ts';
import renderToRoot from '../renderer.tsx';
import log from '../log.ts';
import { windowArguments } from '../rutil.tsx';
import {
  PopupParent,
  PopupParentState,
  popupParentHandler as popupParentHandlerH,
  popupHandler as popupHandlerH,
  PopupParentInitState,
} from '../libxul/popup/popupParentH.tsx';
import Button from '../libxul/button.tsx';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul.tsx';
import { Box, Hbox, Vbox } from '../libxul/boxes.tsx';
import Groupbox from '../libxul/groupbox.tsx';
import Label from '../libxul/label.tsx';
import Menulist from '../libxul/menulist.tsx';
import Radio from '../libxul/radio.tsx';
import Grid, { Column, Columns, Row, Rows } from '../libxul/grid.tsx';
import Textbox from '../libxul/textbox.tsx';
import Spacer from '../libxul/spacer.tsx';
import Stack from '../libxul/stack.tsx';
import Dialog from '../libxul/dialog.tsx';
import ModuleMenu from '../libxul/modulemenu.tsx';
import handlerH, {
  search,
  searchArg,
  hilightStrongs,
  formatResult,
  lexicon,
  strongsCSS,
  getSearchResults,
  Indexing,
  descriptor,
} from './searchH.ts';
import './search.css';

import type { BookGroupType, SearchType } from '../../type.ts';
import Popup from '../libxul/popup/popup.tsx';

const defaultProps = xulDefaultProps;

const propTypes = {
  ...xulPropTypes,
};

type SearchWinProps = XulProps;

const initialState = {
  module: '' as string, // search module
  searchtext: '' as string, // search text
  searchtype: 'SearchExactText' as SearchType['type'], // type of search to do
  scoperadio: 'all' as typeof ScopeRadioOptions[number], // scope radio value
  scopeselect: 'gospel' as BookGroupType | typeof ScopeSelectOptions[number], // scope select value
  moreLess: true as boolean, // more / less state
  displayBible: '' as string, // current module for Bible search results
  results: null as number | null, // count and page-result are returned at different times
  pageindex: 0 as number, // first results index to show
  progress: -1 as number,
  progressLabel: '' as string, // changing progress label
  indexing: false as boolean, // indexer is running
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
  Object.keys(PopupParentInitState)
) as (
  | keyof typeof PopupParentInitState
  | 'results'
  | 'pageindex'
  | 'progress'
  | 'progressLabel'
)[];

let reMountState = null as null | SearchWinState;
let windowLoaded = false;

export type SearchWinState = PopupParentState & typeof initialState;

export default class SearchWin extends React.Component implements PopupParent {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  handler: typeof handlerH;

  popupParentHandler: typeof popupParentHandlerH;

  popupHandler: typeof popupHandlerH;

  popupDelayTO: PopupParent['popupDelayTO'];

  popupUnblockTO: PopupParent['popupUnblockTO'];

  resref: React.RefObject<HTMLDivElement>;

  lexref: React.RefObject<HTMLDivElement>;

  destroy: (() => void)[];

  constructor(props: SearchWinProps) {
    super(props);

    const abible = G.Tabs.find((t) => t.type === C.BIBLE);

    const s: SearchWinState = {
      ...PopupParentInitState,
      ...initialState,
      module: searchArg.module,
      searchtext: searchArg.searchtext,
      searchtype: searchArg.type,
      displayBible:
        searchArg.module &&
        searchArg.module in G.Tab &&
        G.Tab[searchArg.module].type === C.BIBLE
          ? searchArg.module
          : abible?.module ?? '',
    };
    // Adjustments for special startup situations
    if (!(s.module in G.Tab)) s.module = abible?.module || '';
    if (searchArg?.scope) {
      s.scoperadio = 'other';
      s.scopeselect = searchArg.scope as any;
    }
    if (!s.moreLess && s.module && !G.LibSword.luceneEnabled(s.module)) {
      s.moreLess = true;
    }

    const pstate = windowArguments('pstate') as SearchWinState;
    this.state = reMountState || pstate || s;

    this.updateResults = this.updateResults.bind(this);
    this.handler = handlerH.bind(this);
    this.popupParentHandler = popupParentHandlerH.bind(this);
    this.popupHandler = popupHandlerH.bind(this);

    this.resref = React.createRef();
    this.lexref = React.createRef();
    this.destroy = [];
  }

  componentDidMount() {
    const state = this.state as SearchWinState;
    const { module } = state;
    this.destroy.push(
      window.ipc.on('progress', (prog: number, id?: string) => {
        if (id === 'search.indexer') {
          this.setState({ progressLabel: '', progress: prog });
        }
      })
    );
    if (!windowLoaded && module) search(this);
    else this.updateResults();
    windowLoaded = true;
  }

  componentDidUpdate(_prevProps: any, prevState: SearchWinState) {
    const state = this.state as SearchWinState;
    reMountState = clone(state);
    // Save changed window prefs (plus initials to obtain complete state).
    const persistState = drop(state, noPersist) as Omit<
      SearchWinState,
      typeof noPersist[number]
    >;
    const psx = persistState as any;
    const isx = initialState as any;
    if (
      diff(
        { ...prevState, popupParent: null },
        { ...persistState, popupParent: null }
      )
    ) {
      noPersist.forEach((p) => {
        psx[p] = isx[p];
      });
      G.Window.setComplexValue('pstate', persistState);
    }

    // Apply popup fade-in effect
    const { popupParent, elemdata } = state;
    if (popupParent && elemdata && elemdata.length) {
      popupParent.getElementsByClassName('npopup')[0]?.classList.remove('hide');
    }

    this.updateResults();
  }

  componentWillUnmount() {
    this.destroy.forEach((d) => d());
  }

  updateResults() {
    const state = this.state as SearchWinState;
    const { displayBible, module, pageindex, results, searchtext } = state;
    const { resref, lexref } = this;
    const res = resref !== null ? resref.current : null;
    const lex = lexref !== null ? lexref.current : null;
    if (res === null || !module) return;
    const count = results || 0;

    function lexupdate(dModule: string, dModuleIsStrongs: boolean) {
      if (lex === null || res === null) return;
      if (
        res.dataset.count !== count.toString() ||
        res.dataset.module !== dModule
      ) {
        // build a lexicon for the search
        if (!dModule || !results || !dModuleIsStrongs) {
          sanitizeHTML(lex, '');
        } else {
          lexicon(lex, state);
        }
      }
      res.dataset.count = count.toString();
      res.dataset.module = dModule;
      res.dataset.pageindex = pageindex.toString();
    }

    if (res.dataset.count !== count.toString()) {
      strongsCSS.added.forEach((r) => {
        if (r < strongsCSS.sheet.cssRules.length) {
          strongsCSS.sheet.deleteRule(r);
        }
      });
      strongsCSS.added = [];
    }

    const dModule = G.Tab[module].type === C.BIBLE ? displayBible : module;
    let dModuleIsStrongs = false;
    if (
      res.dataset.count !== count.toString() ||
      res.dataset.module !== dModule ||
      res.dataset.pageindex !== pageindex.toString()
    ) {
      if (!dModule || !results) {
        sanitizeHTML(res, '');
      } else {
        // build a page from results, module and pageindex
        if (G.Tab[dModule].isVerseKey) {
          dModuleIsStrongs = /Strongs/i.test(
            G.LibSword.getModuleInformation(dModule, 'Feature') +
              G.LibSword.getModuleInformation(dModule, 'GlobalOptionFilter')
          );
        }
        if (dModuleIsStrongs && /lemma:/.test(searchtext)) {
          hilightStrongs(searchtext.match(/lemma:\s*\S+/g));
        }
        getSearchResults(
          dModule,
          pageindex,
          C.UI.Search.resultsPerPage,
          dModuleIsStrongs
        )
          .then((result) => {
            sanitizeHTML(res, result);
            formatResult(res, state);
            return lexupdate(dModule, dModuleIsStrongs);
          })
          .catch((er) => {
            log.warn(er);
            sanitizeHTML(res, '');
          });
        return;
      }
    }

    lexupdate(dModule, dModuleIsStrongs);
  }

  render() {
    const state = this.state as SearchWinState;
    const { handler, popupHandler, popupParentHandler } = this;
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
      displayBible,
      popupParent,
      popupReset,
      gap,
      elemdata,
      indexing,
    } = state;

    const searchTypes: SearchType['type'][] = [
      'SearchAnyWord',
      'SearchSimilar',
      'SearchExactText',
      'SearchAdvanced',
    ];

    const sos = ScopeSelectOptions.slice() as SearchWinState['scopeselect'][];

    if (searchArg.scope) sos.unshift(searchArg.scope as any);
    C.SupportedBookGroups.forEach((bg) => {
      if (
        module &&
        !['ot', 'nt'].includes(bg) &&
        G.getBooksInVKModule(module).some((bk) => {
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
          {G.i18n.exists(`${option}.label`)
            ? G.i18n.t(`${option}.label`)
            : option}
        </option>
      );
    });

    const location = G.Prefs.getComplexValue(
      'xulsword.location'
    ) as typeof S.prefs.xulsword.location;

    const searchindex = module && G.LibSword.luceneEnabled(module);

    const count = results || 0;
    const lasti =
      count - pageindex < C.UI.Search.resultsPerPage
        ? count
        : pageindex + C.UI.Search.resultsPerPage;
    let searchStatus = '';
    const { i18n } = G;
    if (count > C.UI.Search.resultsPerPage) {
      searchStatus = G.i18n.t('searchStatusPage', {
        v1: dString(G.getLocaleDigits(), pageindex + 1, i18n.language),
        v2: dString(G.getLocaleDigits(), lasti, i18n.language),
        v3: dString(G.getLocaleDigits(), count, i18n.language),
      });
    } else {
      searchStatus = G.i18n.t('searchStatusAll', {
        v1: dString(G.getLocaleDigits(), count, i18n.language),
      });
    }

    return (
      <Vbox className="searchwin">
        {indexing && (
          <Dialog
            className="indexing-dialog"
            key="indexing"
            body={
              <Vbox pack="center" align="center">
                <Label value={G.i18n.t('buildingIndex.label')} />
              </Vbox>
            }
          />
        )}
        {popupParent &&
          elemdata &&
          elemdata.length &&
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
            popupParent
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
                <Groupbox orient="horizontal" align="stretch">
                  <Button id="moreLess" onClick={handler}>
                    {!moreLess && <Label value={G.i18n.t('more.label')} />}
                    {moreLess && <Label value={G.i18n.t('less.label')} />}
                  </Button>
                  <Spacer flex="1" orient="horizontal" />
                  <Hbox className="searchtextLabel" align="center">
                    <Label
                      control="searchtext"
                      value={`${G.i18n.t('searchtext.label')}:`}
                    />
                  </Hbox>
                  <Vbox className="searchtext">
                    <Textbox
                      id="searchtext"
                      value={searchtext}
                      title={G.i18n.t('searchbox.tooltip')}
                      maxLength="60"
                      onChange={handler}
                    />
                    <ModuleMenu id="module" value={module} onChange={handler} />
                  </Vbox>
                  <Button
                    id="searchButton"
                    icon="search"
                    disabled={progress !== -1 || !module}
                    onClick={handler}
                  >
                    {G.i18n.t('menu.search')}
                  </Button>
                  <Spacer flex="1" orient="horizontal" />
                  <Button id="helpButton" icon="help" onClick={handler} />
                </Groupbox>
              </Row>
              <Row>
                <Stack
                  className="searchType"
                  orient="horizontal"
                  align="stretch"
                >
                  <Groupbox
                    id="searchtype"
                    caption={G.i18n.t('searchType.label')}
                    orient="vertical"
                    onChange={handler}
                  >
                    {searchTypes.map((st) => (
                      <Radio
                        key={['type', st].join('.')}
                        name="type"
                        checked={searchtype === st}
                        value={st}
                        label={G.i18n.t(`${st}.label`)}
                        title={G.i18n.t(`${st}.description`)}
                      />
                    ))}
                  </Groupbox>
                  {!searchindex && !indexing && (
                    <>
                      <Vbox />
                      <Vbox align="center">
                        <Button
                          id="createIndexButton"
                          disabled={progress !== -1}
                          onClick={handler}
                        >
                          {G.i18n.t('createIndex.label')}
                        </Button>
                      </Vbox>
                    </>
                  )}
                </Stack>
                <Groupbox
                  id="scoperadio"
                  caption={G.i18n.t('searchScope.label')}
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
                          label={G.i18n.t('search.all')}
                        />
                        <Radio
                          name="scope"
                          checked={scoperadio === 'book'}
                          value="book"
                          label={G.i18n.t('search.currentBook')}
                          disabled={!location?.book}
                        />
                      </Row>
                      <Row>
                        <Radio
                          name="scope"
                          checked={scoperadio === 'ot'}
                          value="ot"
                          label={G.i18n.t('search.ot')}
                        />
                        <Radio
                          name="scope"
                          checked={scoperadio === 'nt'}
                          value="nt"
                          label={G.i18n.t('search.nt')}
                        />
                      </Row>
                      <Row>
                        <div>
                          <Radio
                            name="scope"
                            checked={scoperadio === 'other'}
                            value="other"
                            label={`${G.i18n.t('search.groups')}:`}
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

        <Spacer height={moreLess ? '20' : '10'} />

        <Vbox className="result-container" flex="1">
          <Hbox flex="1">
            <Vbox
              className="resultBox"
              flex="1"
              data-context={displayBible}
              onMouseOut={popupParentHandler}
              onMouseOver={popupParentHandler}
              onMouseMove={popupParentHandler}
            >
              {module && G.Tab[module].type === C.BIBLE && (
                <div>
                  <ModuleMenu
                    id="displayBible"
                    value={displayBible}
                    types={[C.BIBLE]}
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
              <div id="searchResults" ref={this.resref} onClick={handler} />
            </Vbox>
            {count > C.UI.Search.resultsPerPage && (
              <Vbox>
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
        </Vbox>
      </Vbox>
    );
  }
}
SearchWin.defaultProps = defaultProps;
SearchWin.propTypes = propTypes;

renderToRoot(<SearchWin height="100%" />, {
  initialState: { resetOnResize: false },
  onunload: () => {
    if (Indexing.current) {
      G.LibSword.searchIndexCancel(Indexing.current, descriptor.id);
      noAutoSearchIndex(G.Prefs, Indexing.current);
    }
  },
});

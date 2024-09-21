import React, { ChangeEvent } from 'react';
import PropTypes from 'prop-types';
import C from '../../../constant.ts';
import WebAppViewport from '../../webapp/viewport.ts';
import { ofClass } from '../../../common.ts';
import { xulPropTypes, htmlAttribs } from '../libxul/xul.tsx';
import { AnchorButton } from '../libxul/button.tsx';
import Menupopup from '../libxul/menupopup.tsx';
import ModuleMenu from '../libxul/modulemenu.tsx';
import { G, GI } from '../../G.ts';
import RenderPromise from '../../renderPromise.ts';
import './tabs.css';

import type { XulswordStateArgType } from '../../../type.ts';
import type S from '../../../defaultPrefs.ts';
import type {
  RenderPromiseComponent,
  RenderPromiseState,
} from '../../renderPromise.ts';
import type { XulProps } from '../libxul/xul.tsx';
import type { TonCellClick } from '../libxul/table.tsx';

const propTypes = {
  ...xulPropTypes,
  isPinned: PropTypes.bool.isRequired,
  module: PropTypes.string,
  panelIndex: PropTypes.number.isRequired,
  tabs: PropTypes.arrayOf(PropTypes.string).isRequired,
  ilModule: PropTypes.string,
  ilModuleOption: PropTypes.arrayOf(PropTypes.string).isRequired,
  mtModule: PropTypes.string,
  xulswordState: PropTypes.func,
};

type TabsProps = {
  isPinned: boolean;
  module: string | undefined;
  panelIndex: number;
  tabs: string[];
  ilModule: string | undefined;
  ilModuleOption: Array<string | undefined>;
  mtModule: string | undefined;
  xulswordState: (s: XulswordStateArgType) => void;
} & XulProps;

type TabsState = RenderPromiseState & {
  multiTabs: string[];
  multiTabMenupopup: any;
};

// XUL Tabs
class Tabs extends React.Component implements RenderPromiseComponent {
  static propTypes: typeof propTypes;

  tabsref: React.RefObject<HTMLDivElement>;

  renderPromise: RenderPromise;

  constructor(props: TabsProps) {
    super(props);

    this.state = {
      multiTabMenupopup: null,
      multiTabs: [],
      renderPromiseID: 0,
    } as TabsState;
    this.tabsref = React.createRef();
    this.checkTabWidth = this.checkTabWidth.bind(this);
    this.multiTabButtonClick = this.multiTabButtonClick.bind(this);
    this.getTab = this.getTab.bind(this);
    this.getMultiTabSelection = this.getMultiTabSelection.bind(this);
    this.toggleTab = this.toggleTab.bind(this);

    this.renderPromise = new RenderPromise(this);
  }

  // Only when the tabs key prop changes will React instantiate a new tabs
  // component and thus resize the tabs to the current window.
  componentDidMount() {
    const { renderPromise } = this;
    this.checkTabWidth();
    renderPromise.dispatch();
  }

  componentDidUpdate() {
    const { renderPromise } = this;
    renderPromise.dispatch();
  }

  toggleTab(e: React.SyntheticEvent<ChangeEvent>) {
    const { target } = e;
    if (target) {
      const { value } = target as HTMLSelectElement;
      const { panelIndex, xulswordState } = this.props as TabsProps;
      const vp = Build.isWebApp ? WebAppViewport : G.Viewport;
      const xs = vp.setXulswordTabs({
        panelIndex,
        whichTab: value,
        doWhat: 'toggle',
      });
      const newtabs = xs.tabs[panelIndex];
      if (newtabs && newtabs.includes(value)) {
        xulswordState((prevState) => {
          const { panels: pans, mtModules } = prevState;
          const s: Partial<typeof S.prefs.xulsword> = {
            panels: pans.slice(),
          };
          if (!s.panels) s.panels = [];
          s.panels[panelIndex] = value;
          return s;
        });
      }
    }
  }

  getTab(
    m: string | undefined,
    type: string,
    classes: string,
    children: any = null,
    renderPromise: RenderPromise,
  ) {
    const { panelIndex: i } = this.props as TabsProps;
    const tabType = !m || type === 'ilt-tab' ? 'Texts' : G.Tab[m].tabType;
    const label =
      !m || type === 'ilt-tab'
        ? GI.i18n.t('', renderPromise, 'ORIGLabelTab')
        : G.Tab[m].label;
    return (
      <div
        key={`${type}_${i}_${m}`}
        className={`${type} tab tab${tabType} ${classes}`}
        data-module={m}
        data-index={i}
        title={
          (m && m in G.Tab && G.Tab[m].conf.Description?.locale) || undefined
        }
      >
        <div className="border">
          <div className="tab-label">{label}</div>
          {children}
        </div>
      </div>
    );
  }

  getMultiTabSelection(multiTabs: string[]) {
    const { module, mtModule } = this.props as TabsProps;
    if (module && multiTabs.includes(module)) return module;
    if (mtModule && multiTabs.includes(mtModule)) return mtModule;
    if (multiTabs.length && multiTabs[0]) return multiTabs[0];
    return null;
  }

  // Move tabs to the multi-tab until there is no overflow.
  checkTabWidth() {
    const { tabsref } = this;
    const { tabs } = this.props as TabsProps;
    const { multiTabs } = this.state as TabsState;
    const newMultiTabs = multiTabs.slice();
    const tabsdiv = tabsref.current;
    const tdivs = tabsdiv?.getElementsByClassName(
      'reg-tab',
    ) as HTMLCollectionOf<HTMLElement>;
    const twids =
      (tdivs &&
        Array.from(tdivs).map(
          (d) => d.offsetWidth + 2 * C.UI.Viewport.TabMargin,
        )) ||
      [];
    const iltab = tabsdiv?.getElementsByClassName(
      'ilt-tab',
    )[0] as HTMLElement | null;
    const iltwidth =
      (iltab && iltab.offsetWidth + 2 * C.UI.Viewport.TabMargin) || 0;
    for (;;) {
      // The future mts-tab width must be recalculated for each width check.
      const mtsel = this.getMultiTabSelection(newMultiTabs);
      const mtindex = mtsel !== null ? tabs.indexOf(mtsel) : -1;
      const mtwidth = mtindex > -1 ? twids[mtindex] : 0;
      const ptwidth = 34; // tabPlus width
      // Get the index of the ntext tab to be moved.
      const nextTabIndex = newMultiTabs.length
        ? tabs.indexOf(newMultiTabs[0]) - 1
        : tabs.length - 1;
      if (nextTabIndex < 0) break;
      const contentWidth =
        C.UI.Viewport.TabRowMargin +
        2 * C.UI.Viewport.TabMarginFirstLast +
        twids.slice(0, nextTabIndex + 1).reduce((p, c) => p + c, 0) +
        ptwidth +
        mtwidth +
        iltwidth;
      if (
        !tabsdiv ||
        tabs.length <= 2 ||
        (newMultiTabs.length !== 1 && contentWidth <= tabsdiv.clientWidth)
      ) {
        break;
      }
      // Move next tab to the multi-tab.
      newMultiTabs.unshift(tabs[nextTabIndex]);
    }
    if (multiTabs.length !== newMultiTabs.length) {
      this.setState({ multiTabs: newMultiTabs });
    }
  }

  multiTabButtonClick(e: React.SyntheticEvent<TonCellClick>) {
    const { renderPromise } = this;
    const { multiTabMenupopup } = this.state as TabsState;
    if (
      !multiTabMenupopup ||
      (multiTabMenupopup && ofClass('button-box', e.target))
    )
      e.stopPropagation();
    this.setState((prevState: TabsState) => {
      let newpup = null;
      if (!prevState.multiTabMenupopup) {
        const { multiTabs } = prevState;
        const textrow = document.getElementsByClassName('textrow');
        const height = textrow.length ? textrow[0].clientHeight : null;
        newpup = (
          <Menupopup style={height ? { maxHeight: `${height}px` } : undefined}>
            {multiTabs.map((m) => {
              return this.getTab(
                m,
                'mto-tab',
                m === this.getMultiTabSelection(multiTabs) ? 'selected' : '',
                null,
                renderPromise,
              );
            })}
          </Menupopup>
        );
      }
      return { multiTabMenupopup: newpup };
    });
  }

  render() {
    const { multiTabs, multiTabMenupopup } = this.state as TabsState;
    const { module, isPinned, panelIndex, tabs, ilModule, ilModuleOption } =
      this.props as TabsProps;
    const { renderPromise, toggleTab } = this;

    let ilTabLabel = GI.i18n.t('', renderPromise, 'ORIGLabelTab');
    if (!ilTabLabel) ilTabLabel = 'ilt';

    const mtMod = this.getMultiTabSelection(multiTabs);

    let ilcls = '';
    if (ilModule) ilcls = 'active';
    if (ilModule === 'disabled') ilcls = 'disabled';

    let cls = `tabs${panelIndex}`;
    if (isPinned) cls += ' pinned';
    if (multiTabMenupopup) cls += ' open';

    return (
      <div
        {...htmlAttribs(`tabs ${cls}`, this.props)}
        ref={this.tabsref}
        data-index={panelIndex}
        data-ispinned={isPinned}
      >
        {module &&
          isPinned &&
          this.getTab(module, 'reg-tab', 'active', null, renderPromise)}
        {!isPinned && (
          <div
            className={`tabPlus tab active`}
            title={GI.i18n.t('', renderPromise, 'Add a tab, or remove a tab.')}
          >
            <div className="border">
              <ModuleMenu
                value={module || ''}
                language
                description
                onChange={toggleTab}
              />
            </div>
          </div>
        )}
        {tabs.map((m: string) => {
          if (isPinned || !m || multiTabs.includes(m)) return null;
          const selected = m === module ? 'active' : '';
          return this.getTab(m, 'reg-tab', selected, null, renderPromise);
        })}
        {!isPinned &&
          multiTabs.length > 0 &&
          mtMod &&
          this.getTab(
            mtMod,
            'mts-tab',
            module === mtMod ? 'active' : '',
            <AnchorButton onClick={this.multiTabButtonClick}>
              {multiTabMenupopup}
            </AnchorButton>,
            renderPromise,
          )}
        {!isPinned &&
          (ilModule === 'disabled' || ilModuleOption[0]) &&
          this.getTab(ilModuleOption[0], 'ilt-tab', ilcls, null, renderPromise)}
      </div>
    );
  }
}
Tabs.propTypes = propTypes;

export default Tabs;

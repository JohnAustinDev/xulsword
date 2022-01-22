/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import i18next from 'i18next';
import C from '../../constant';
import { ofClass } from '../../common';
import {
  xulDefaultProps,
  xulPropTypes,
  XulProps,
  htmlAttribs,
} from '../libxul/xul';
import Button from '../libxul/button';
import Menupopup from '../libxul/menupopup';
import Tooltip from '../libxul/tooltip';
import G from '../rg';
import '../libxul/xul.css';
import './tabs.css';

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
  columns: PropTypes.number.isRequired,
  isPinned: PropTypes.bool.isRequired,
  module: PropTypes.string,
  n: PropTypes.number.isRequired,
  tabs: PropTypes.arrayOf(PropTypes.string).isRequired,
  ilModule: PropTypes.string,
  ilModuleOption: PropTypes.arrayOf(PropTypes.string).isRequired,
  mtModule: PropTypes.string,
};

interface TabsProps extends XulProps {
  columns: number;
  isPinned: boolean;
  module: string | undefined;
  n: number;
  tabs: string[];
  ilModule: string | undefined;
  ilModuleOption: (string | undefined)[];
  mtModule: string | undefined;
}

interface TabsState {
  multiTabDone: boolean;
  multiTabs: string[];
  multiTabMenupopup: any;
}

// XUL Tabs
class Tabs extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  tabsref: React.RefObject<HTMLDivElement>;

  constructor(props: TabsProps) {
    super(props);

    this.state = {
      multiTabDone: false,
      multiTabMenupopup: null,
      multiTabs: [],
    };
    this.tabsref = React.createRef();
    this.checkTabWidth = this.checkTabWidth.bind(this);
    this.multiTabButtonClick = this.multiTabButtonClick.bind(this);
    this.getTab = this.getTab.bind(this);
    this.getMultiTabSelection = this.getMultiTabSelection.bind(this);
  }

  // The multi-tab is built over a series of render cycles that start
  // when this tabs component is mounted and end when its width fits
  // the window width. Only when the tabs key prop changes will React
  // instaniate a new tabs component and thus resize the tabs to the
  // current window.
  componentDidMount() {
    const { multiTabDone } = this.state as TabsState;
    if (!multiTabDone) this.checkTabWidth();
  }

  componentDidUpdate() {
    const { multiTabDone } = this.state as TabsState;
    if (!multiTabDone) this.checkTabWidth();
  }

  getTab(
    m: string | undefined,
    type: string,
    classes: string,
    children: any = null
  ) {
    const { n } = this.props as TabsProps;
    const tabType = !m || type === 'ilt-tab' ? 'Texts' : G.Tab[m].tabType;
    const label =
      !m || type === 'ilt-tab' ? i18next.t('ORIGLabelTab') : G.Tab[m].label;
    return (
      <div
        key={`${type}_${n}_${m}`}
        className={`${type} tab tab${tabType} ${classes}`}
        data-module={m}
        data-wnum={n}
      >
        <div className="tab-label">{label}</div>
        {children}
      </div>
    );
  }

  getMultiTabSelection() {
    const { module, mtModule } = this.props as TabsProps;
    const { multiTabs } = this.state as TabsState;
    if (module && multiTabs.includes(module)) return module;
    if (mtModule && multiTabs.includes(mtModule)) return mtModule;
    if (multiTabs.length && multiTabs[0]) return multiTabs[0];
    return null;
  }

  // Move 1 or 2 tabs to the multi-tab if there are any overflowing
  checkTabWidth() {
    const { tabsref } = this;
    const { tabs } = this.props as TabsProps;
    const { multiTabs } = this.state as TabsState;
    const newMultiTabs = multiTabs.slice();
    const tabsdiv = tabsref.current;
    if (tabsdiv && tabsdiv.scrollWidth > tabsdiv.clientWidth) {
      // Add 1 or 2 tabs to the multi-tab.
      let nm = multiTabs.length ? 1 : 2;
      let last: string | null = multiTabs[0];
      for (let x = tabs.length - 1; nm && x !== -1; x -= 1) {
        if (last) {
          if (last === tabs[x]) {
            last = null;
          }
        } else {
          newMultiTabs.unshift(tabs[x]);
          nm -= 1;
        }
      }
      if (nm === 0) {
        this.setState({ multiTabs: newMultiTabs });
      }
    } else {
      this.setState({ multiTabDone: true });
    }
  }

  multiTabButtonClick(e: any) {
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
                m === this.getMultiTabSelection() ? 'selected' : ''
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
    const { module, isPinned, n, tabs, ilModule, ilModuleOption } = this
      .props as TabsProps;

    let ilTabLabel = i18next.t('ORIGLabelTab');
    if (!ilTabLabel) ilTabLabel = 'ilt';

    const mtMod = this.getMultiTabSelection();

    let ilcls = '';
    if (ilModule) ilcls = 'active';
    if (ilModule === 'disabled') ilcls = 'disabled';

    let cls = `tabs${n}`;
    if (module && G.Tab[module].isRTL) cls += ' rtl';
    if (isPinned) cls += ' pinned';
    if (multiTabMenupopup) cls += ' open';

    return (
      <div
        {...htmlAttribs(`tabs ${cls}`, this.props)}
        ref={this.tabsref}
        data-wnum={n}
      >
        {module && isPinned && this.getTab(module, 'reg-tab', 'active')}
        {tabs.map((m: string) => {
          if (isPinned || !m || multiTabs.includes(m)) return null;
          const selected = m === module ? 'active' : '';
          return this.getTab(m, 'reg-tab', selected);
        })}
        {!isPinned &&
          multiTabs.length > 0 &&
          mtMod &&
          this.getTab(
            mtMod,
            'mts-tab',
            module === mtMod ? 'active' : '',
            <Button type="menu" onClick={this.multiTabButtonClick}>
              {multiTabMenupopup}
            </Button>
          )}
        {!isPinned &&
          (ilModule === 'disabled' || ilModuleOption[0]) &&
          this.getTab(ilModuleOption[0], 'ilt-tab', ilcls)}
      </div>
    );
  }
}
Tabs.defaultProps = defaultProps;
Tabs.propTypes = propTypes;

export default Tabs;

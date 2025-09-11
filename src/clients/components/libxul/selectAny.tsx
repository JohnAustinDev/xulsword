import React from 'react';
import { clone, getModuleOfObject, randomID } from '../../../common.ts';
import { G, GI } from '../../G.ts';
import RenderPromise from '../../renderPromise.ts';
import { htmlAttribs } from './xul.tsx';
import SelectVK from './selectVK.tsx';
import SelectOR from './selectOR.tsx';
import { Hbox } from './boxes.tsx';
import ModuleMenu from './modulemenu.tsx';
import './selectAny.css';

import type {
  LocationORType,
  LocationTypes,
  LocationVKCommType,
  LocationVKType,
  TabTypes,
} from '../../../type.ts';
import type {
  RenderPromiseComponent,
  RenderPromiseState,
} from '../../renderPromise.ts';
import type { XulProps } from './xul.tsx';
import type { SelectVKType } from './selectVK.tsx';
import type { SelectORMType } from './selectOR.tsx';

// Allow users to select any location from any kind of module.

// The SelectAny keeps its own state and is not a controlled component, so
// the onSelection prop must be used to read the current selection. The key
// prop can be used to update state to the latest prop value.
//
// The modules prop is an array of module codes to appear in the option list
// (which need not be installed). If left undefined, all installed modules
// will be available. If a module which is not installed is selected, its
// location cannot be changed.
export type SelectAnyProps = {
  initial: LocationTypes[TabTypes];
  modules?: string[];
  disabled?: boolean;
  onSelection: (
    selection: LocationTypes[TabTypes] | undefined,
    id?: string,
  ) => void;
} & XulProps;

type SelectAnyState = RenderPromiseState & {
  location: LocationTypes[TabTypes] | undefined;
  reset: string;
};

let LastVKLocation: LocationVKType | LocationVKCommType | undefined;

export default class SelectAny
  extends React.Component<SelectAnyProps, SelectAnyState>
  implements RenderPromiseComponent
{
  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLDivElement>;

  constructor(props: SelectAnyProps) {
    super(props);
    let { initial } = props;
    if (!initial) {
      initial = { book: 'Gen', chapter: 1, v11n: 'KJV' };
    }

    const s: SelectAnyState = {
      location: initial,
      reset: randomID(),
      renderPromiseID: 0,
    };
    this.state = s;

    this.onChange = this.onChange.bind(this);
    this.onModuleChange = this.onModuleChange.bind(this);

    this.loadingRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);
  }

  componentDidMount() {
    const { renderPromise } = this;
    renderPromise.dispatch();
  }

  componentDidUpdate() {
    const { renderPromise } = this;
    renderPromise.dispatch();
  }

  onChange(selection?: SelectVKType | SelectORMType, id?: string) {
    const { onSelection } = this.props as SelectAnyProps;
    let location: LocationTypes[TabTypes] | undefined;
    if (selection) {
      if ('v11n' in selection) {
        location = selection;
      } else {
        const { otherMod, keys } = selection;
        location = {
          otherMod,
          key: keys[0] || '',
        };
      }
    }
    this.setState({ location });
    onSelection(location, id);
  }

  async onModuleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const { state, renderPromise } = this;
    const { location: oldloc } = state;
    const module = e.target.value;
    const newType = G.Tab[module].tabType;
    let location: LocationTypes[TabTypes];
    if (newType === 'Texts') {
      let intloc: LocationVKType | LocationVKCommType;
      if (oldloc && 'v11n' in oldloc) intloc = oldloc;
      else {
        if (LastVKLocation === undefined) {
          intloc = (await newLocation(module, renderPromise)) as LocationVKType;
        } else {
          intloc = LastVKLocation;
        }
      }
      location = clone(intloc);
      location.vkMod = module;
      delete (location as any).commMod;
    } else if (newType === 'Comms') {
      let intloc: LocationVKType | LocationVKCommType;
      if (oldloc && 'v11n' in oldloc) {
        intloc = oldloc;
      } else {
        if (LastVKLocation === undefined) {
          intloc = (await newLocation(
            module,
            renderPromise,
          )) as LocationVKCommType;
        } else {
          intloc = LastVKLocation;
        }
      }
      location = clone(intloc);
      location.vkMod = undefined;
      (location as LocationVKCommType).commMod = module;
    } else {
      if (oldloc && 'v11n' in oldloc) {
        LastVKLocation = clone(oldloc);
      }
      location = await newLocation(module, renderPromise);
    }
    this.setState({
      location,
      reset: randomID(),
    });
  }

  render() {
    const { props, state, onChange, onModuleChange, loadingRef } = this;
    const { location, reset } = state;
    const { modules, disabled } = props;

    if (!location) return null;
    const module = getModuleOfObject(location) || '';

    let select: JSX.Element;
    if ('v11n' in location) {
      select = (
        <SelectVK
          key={[reset].join('.')}
          initialVK={location}
          options={{ lastchapters: [] }}
          disabled={disabled}
          onSelection={onChange}
        />
      );
    } else {
      const { otherMod, key } = location;
      select = (
        <SelectOR
          key={[reset].join('.')}
          flex="1"
          initialORM={{ otherMod, keys: [key] }}
          enableParentSelection
          enableMultipleSelection={false}
          disabled={disabled}
          onSelection={onChange}
        />
      );
    }

    return (
      <Hbox
        domref={loadingRef}
        pack="start"
        align="start"
        {...htmlAttribs('selectany', props)}
      >
        {/* Although SelectOR and SelectVK have their own ModuleMenu
        selectors, they filter out unsupported modules. So this ModuleMenu
        is needed because it will not filter. */}
        <ModuleMenu
          className={`any-module ${'v11n' in location ? 'vksel' : 'orsel'}`}
          value={module}
          modules={modules}
          allowNotInstalled
          disabled={disabled}
          onChange={onModuleChange}
        />
        {select}
      </Hbox>
    );
  }
}

// Pick a valid location from any installed module.
async function newLocation(
  module: string,
  renderPromise: RenderPromise,
): Promise<LocationVKType | LocationVKCommType | LocationORType> {
  const { tabType, v11n } = G.Tab[module];
  let r: LocationVKType | LocationVKCommType | LocationORType;
  if (tabType === 'Texts') {
    r = {
      vkMod: module,
      book: GI.getBooksInVKModule(['Gen'], renderPromise, module)[0],
      chapter: 1,
      verse: 1,
      lastverse: 1,
      v11n: v11n || null,
    };
  } else if (tabType === 'Comms') {
    r = {
      commMod: module,
      book: GI.getBooksInVKModule(['Gen'], renderPromise, module)[0],
      chapter: 1,
      verse: 1,
      lastverse: 1,
      v11n: v11n || null,
    };
  } else if (tabType === 'Dicts') {
    const keylist = GI.getAllDictionaryKeyList([], renderPromise, module);
    r = { otherMod: module, key: keylist[0] || '' };
  } else {
    const toc = GI.genBookTreeNodes([], renderPromise, module);
    r = { otherMod: module, key: toc[0]?.id.toString() || '' };
  }
  return r;
}

/* eslint-disable react/forbid-prop-types */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import { randomID, sanitizeHTML } from '../../common';
import { moduleInfoHTML } from '../rutil';
import G from '../rg';
import { xulDefaultProps, xulPropTypes, XulProps, htmlAttribs } from './xul';
import Button from './button';
import Label from './label';
import '../libsword.css'; // modinfo uses .head1
import './modinfo.css';

import type { SwordConfType } from '../../type';

// Parent component should have this included in its state and state-type.
export const modinfoParentInitialState = {
  showConf: '' as string,
  editConf: false as boolean,
};

// Parent component should implement this interface.
export interface ModinfoParent {
  state: React.ComponentState;
  modinfoRefs: {
    textarea: React.RefObject<HTMLTextAreaElement>;
    container: React.RefObject<HTMLDivElement>;
  };
  setState: React.Component['setState'];
}

// Parent component should pass this function (bound) to the
// Modinfo buttonHandler prop.
export function modinfoParentHandler(
  this: ModinfoParent,
  e: React.SyntheticEvent
): void {
  switch (e.type) {
    case 'click': {
      const target = e.currentTarget as HTMLElement;
      const [id, m] = target.id.split('.');
      switch (id) {
        case 'more': {
          const s: Partial<ModinfoParent['state']> = {
            showConf: m,
            editConf: false,
          };
          this.setState(s);
          break;
        }
        case 'less': {
          const s: Partial<ModinfoParent['state']> = {
            showConf: '',
            editConf: false,
          };
          this.setState(s);
          break;
        }
        case 'edit': {
          const s: Partial<ModinfoParent['state']> = {
            editConf: true,
          };
          this.setState(s);
          break;
        }
        case 'save': {
          if (m && m in G.Tab) {
            const { modinfoRefs } = this;
            const { textarea } = modinfoRefs;
            if (textarea?.current?.value) {
              G.Module.writeConf(G.Tab[m].confPath, textarea?.current?.value);
              const s: Partial<ModinfoParent['state']> = {
                editConf: false,
              };
              this.setState(s);
            }
          }
          break;
        }
        case 'top': {
          const { modinfoRefs } = this;
          const { container } = modinfoRefs;
          const scrollcont = container.current?.childNodes[0] as HTMLDivElement;
          if (scrollcont) scrollcont.scrollTop = 0;
          break;
        }
        default:
          throw new Error(`Unhandled click event ${id} in about.tsx`);
      }
      break;
    }
    default:
  }
}

// XUL Sword module info and config
const defaultProps = {
  ...xulDefaultProps,
  configs: undefined,
  showConf: '',
  editConf: undefined,
};

const propTypes = {
  ...xulPropTypes,
  modules: PropTypes.arrayOf(PropTypes.string).isRequired,
  configs: PropTypes.arrayOf(PropTypes.object),
  showConf: PropTypes.string,
  editConf: PropTypes.bool,
  refs: PropTypes.object.isRequired,
  buttonHandler: PropTypes.func.isRequired,
};

interface ModinfoProps extends XulProps {
  modules: string[]; // modules to show
  configs: (SwordConfType | null)[] | undefined; // required only if modules are not already installed
  showConf: string; // module whose conf to show, or '' to show none
  editConf: boolean | undefined; // is that conf editable?
  refs: {
    container: React.RefObject<HTMLDivElement>; // ref to control scrolling
    textarea: React.RefObject<HTMLTextAreaElement>; // ref to retreive conf edits
  };
  buttonHandler: (e: React.SyntheticEvent) => void | Promise<void>;
}

function Modinfo(props: ModinfoProps) {
  const {
    modules: ms,
    configs: cs,
    showConf,
    editConf,
    refs,
    buttonHandler,
  } = props;
  const { container, textarea } = refs;
  const id = randomID();

  const modules: string[] = [];
  const configs: SwordConfType[] = [];
  ms.forEach((m, i) => {
    const csi = G.SwordConf[m] || (cs && cs[i]);
    if (csi) {
      modules.push(m);
      configs.push(csi);
    }
  });

  // Currently it is not possible to access the config file text for a
  // module unless it is installed locally (aw shucks).
  const confPath =
    (showConf && showConf in G.Tab && G.Tab[showConf].confPath) || '';
  const conftext: string[] =
    (showConf &&
      confPath &&
      G.inlineFile(confPath, 'utf8', true).split('\n')) ||
    [];

  const showLinkList = modules.length > 4;

  return (
    <div {...htmlAttribs('modinfo', props)} ref={container}>
      <div>
        {showLinkList &&
          ['Texts', 'Comms', 'Dicts', 'Genbks'].map((t) => (
            <div key={`lt${t}`} className="linklist">
              {modules.some((m) => m in G.Tab && G.Tab[m].tabType === t) && (
                <>
                  <div className="head1">{G.i18n.t(t)}</div>
                  <div className="listbox">
                    <ul>
                      {modules
                        ?.sort((a, b) =>
                          G.Tab[a].label.localeCompare(G.Tab[b].label)
                        )
                        .map((m) =>
                          G.Tab[m].tabType === t ? (
                            <li key={`lm${m}`}>
                              <a
                                href={`#${['module', m, id].join('.')}`}
                                className={`cs-${m}`}
                              >
                                {G.Tab[m].label}
                              </a>
                            </li>
                          ) : null
                        )}
                    </ul>
                  </div>
                </>
              )}
            </div>
          ))}
        {modules?.map((m) => (
          <div
            id={['module', m, id].join('.')}
            className={`modlist x-${m}`}
            key={`ml${m}`}
          >
            <div className="head1">
              <span className={`cs-${m}`}>
                {configs?.find((c) => c.module === m)?.module}
              </span>
              {showLinkList && (
                <a
                  href="#"
                  id={['top', m, id].join('.')}
                  className="top-link"
                  onClick={buttonHandler}
                >
                  ↑
                </a>
              )}
            </div>
            <div
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{
                __html: sanitizeHTML(
                  (configs &&
                    moduleInfoHTML([
                      configs.find((c) => c.module === m) as SwordConfType,
                    ])) ||
                    ''
                ),
              }}
            />
            <div>
              {m in G.Tab && G.Tab[m].confPath && !(showConf === m) && (
                <>
                  <Button
                    id={['more', m, id].join('.')}
                    onClick={buttonHandler}
                  >
                    {G.i18n.t('more.label')}
                  </Button>
                </>
              )}
              {showConf && showConf === m && (
                <>
                  <Button
                    id={['less', m, id].join('.')}
                    onClick={buttonHandler}
                  >
                    {G.i18n.t('less.label')}
                  </Button>
                  {editConf !== undefined && textarea !== undefined && (
                    <>
                      <Button
                        id={['edit', m, id].join('.')}
                        onClick={buttonHandler}
                      >
                        {G.i18n.t('editMenu.label')}
                      </Button>
                      <Button
                        id={`save.${m}.${id}`}
                        disabled={!editConf}
                        onClick={buttonHandler}
                      >
                        {G.i18n.t('save.label')}
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
            {showConf && showConf === m && (
              <div>
                <Label
                  className="confpath-label"
                  control={`ta.${m}`}
                  value={confPath}
                />
                <textarea
                  id={['ta', m, id].join('.')}
                  defaultValue={conftext.join('\n')}
                  className={editConf ? 'editable' : 'readonly'}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  wrap="off"
                  readOnly={!editConf}
                  rows={conftext.length}
                  ref={textarea}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
Modinfo.defaultProps = defaultProps;
Modinfo.propTypes = propTypes;

export default Modinfo;

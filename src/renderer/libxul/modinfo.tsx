/* eslint-disable react/forbid-prop-types */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import {
  isRepoLocal,
  repositoryModuleKey,
  sanitizeHTML,
  stringHash,
} from '../../common';
import C from '../../constant';
import G from '../rg';
import { moduleInfoHTML } from '../rutil';
import { xulDefaultProps, xulPropTypes, XulProps, htmlAttribs } from './xul';
import Button from './button';
import Label from './label';
import '../libsword.css'; // modinfo uses .head1
import './modinfo.css';

import type { ModTypes, SwordConfType, TabTypes } from '../../type';

// Parent component should have this included in its state and state-type.
export const modinfoParentInitialState = {
  showConf: '' as string,
  editConf: false as boolean,
};

// Parent component should implement this interface.
export interface ModinfoParent {
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
      const [id, muni] = target.id.split('.');
      switch (id) {
        case 'more': {
          const s: typeof modinfoParentInitialState = {
            showConf: muni,
            editConf: false,
          };
          this.setState(s);
          break;
        }
        case 'less': {
          const s: typeof modinfoParentInitialState = {
            showConf: '',
            editConf: false,
          };
          this.setState(s);
          break;
        }
        case 'edit': {
          const s: Partial<typeof modinfoParentInitialState> = {
            editConf: true,
          };
          this.setState(s);
          break;
        }
        case 'save': {
          if (muni) {
            const { modinfoRefs } = this;
            const { textarea } = modinfoRefs;
            if (textarea?.current?.value) {
              const { dataset } = textarea?.current;
              const { confPath } = dataset;
              if (confPath) {
                G.Module.writeConf(confPath, textarea.current.value);
                const s: Partial<typeof modinfoParentInitialState> = {
                  editConf: false,
                };
                this.setState(s);
              }
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
  showConf: '',
  editConf: undefined,
};

const propTypes = {
  ...xulPropTypes,
  configs: PropTypes.arrayOf(PropTypes.object).isRequired,
  showConf: PropTypes.string,
  editConf: PropTypes.bool,
  refs: PropTypes.object.isRequired,
  buttonHandler: PropTypes.func.isRequired,
};

interface ModinfoProps extends XulProps {
  configs: SwordConfType[];
  showConf: string; // unique id of conf to show
  editConf: boolean | undefined; // is showConf editable?
  refs: {
    container: React.RefObject<HTMLDivElement>; // ref to control scrolling
    textarea: React.RefObject<HTMLTextAreaElement>; // ref to retreive conf edits
  };
  buttonHandler: (e: React.SyntheticEvent) => void | Promise<void>;
}

type SwordConfExtraType = SwordConfType & {
  modUnique: string;
  confPath: string | null;
  label: string;
  style: string;
};

function Modinfo(props: ModinfoProps) {
  const {
    configs: configsx,
    showConf: showConfx,
    editConf,
    refs,
    buttonHandler,
  } = props;
  const { container, textarea } = refs;

  // Is not possible to edit or (currently) view a config file unless it
  // is installed locally.
  const configs: SwordConfExtraType[] = configsx
    .map((c) => {
      const m = c.module;
      const data = {
        confPath: null as null | string,
        label: m in G.Tab ? G.Tab[m].label : m,
        style: m in G.Tab ? G.Tab[m].labelClass : 'cs-LTR_DEFAULT',
        modUnique: stringHash(repositoryModuleKey(c)),
      };
      if (c && isRepoLocal(c.sourceRepository)) {
        data.confPath = [c.sourceRepository.path, 'mods.d', c.filename].join(
          '/'
        );
      }
      return {
        ...c,
        ...data,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const showConf: SwordConfExtraType | null =
    (showConfx && configs.find((c) => c.modUnique === showConfx)) || null;

  const conftext: string[] =
    (showConf?.confPath &&
      G.inlineFile(showConf.confPath, 'utf8', true).split('\n')) ||
    [];

  const showLinkList = configs.length > 4;

  return (
    <div {...htmlAttribs('modinfo', props)} ref={container}>
      <div>
        {showLinkList &&
          [
            'Biblical Texts',
            'Commentaries',
            'Lexicons / Dictionaries',
            'Generic Books',
            'XSM_audio',
          ].map((g) => (
            <div key={`lt${g}`} className="linklist">
              {configs.some((c) => c.moduleType === g || c.xsmType === g) && (
                <>
                  <div className="head1">
                    {G.i18n.t(
                      ((g in C.SupportedTabTypes &&
                        C.SupportedTabTypes[g as ModTypes]) ||
                        'Genbks') as TabTypes
                    )}
                  </div>
                  <div className="listbox">
                    <ul>
                      {configs.map((c) =>
                        c.moduleType === g || c.xsmType === g ? (
                          <li key={`lm${c.module}`}>
                            <a
                              href={`#${['module', c.modUnique].join('.')}`}
                              className={c.style}
                            >
                              {c.label}
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
        {configs?.map((c) => (
          <div
            id={['module', c.modUnique].join('.')}
            className={`modlist x-${c.module}`}
            key={`ml${c.module}`}
          >
            <div className="head1">
              <span className={`cs-${c.module}`}>{c.module}</span>
              {showLinkList && (
                <a
                  href="#"
                  id={['top', c.modUnique].join('.')}
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
                __html: sanitizeHTML((configs && moduleInfoHTML([c])) || ''),
              }}
            />
            <div>
              {c.confPath && !(showConf === c) && (
                <>
                  <Button
                    id={['more', c.modUnique].join('.')}
                    onClick={buttonHandler}
                  >
                    {G.i18n.t('more.label')}
                  </Button>
                </>
              )}
              {showConf && showConf === c && (
                <>
                  <Button
                    id={['less', c.modUnique].join('.')}
                    onClick={buttonHandler}
                  >
                    {G.i18n.t('less.label')}
                  </Button>
                  {editConf !== undefined && textarea !== undefined && (
                    <>
                      <Button
                        id={['edit', c.modUnique].join('.')}
                        onClick={buttonHandler}
                      >
                        {G.i18n.t('menu.edit')}
                      </Button>
                      <Button
                        id={['save', c.modUnique].join('.')}
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
            {showConf && showConf === c && (
              <div>
                <Label
                  className="confpath-label"
                  control={`ta.${c.module}`}
                  value={c.confPath || ''}
                />
                <textarea
                  id={['ta', c.modUnique].join('.')}
                  defaultValue={conftext.join('\n')}
                  className={editConf ? 'editable' : 'readonly'}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  wrap="off"
                  readOnly={!editConf}
                  rows={conftext.length}
                  ref={textarea}
                  data-conf-path={c.confPath}
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

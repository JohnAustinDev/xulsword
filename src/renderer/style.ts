import G from './rg';

import type { ConfigType } from '../type';
import { createStyleRule } from '../common';

export type StyleType = {
  [i in 'locale' | 'module' | 'program']: {
    [key in string | 'default']: Partial<ConfigType>;
  };
};

function getConfig(
  styleType?: Partial<StyleType>,
  type?: keyof StyleType,
  key?: string
): Partial<ConfigType> | null {
  if (!styleType || !type || !key) return null;
  const t0 = type in styleType ? styleType[type] : null;
  if (t0) {
    return key in t0 ? t0[key] : null;
  }
  return null;
}

function insertRule(
  sheet: CSSStyleSheet,
  prefix: string,
  instance: string,
  config?: Partial<ConfigType> | null
) {
  if (config) {
    const r = createStyleRule(`.${prefix}-${instance}`, config);
    if (r) sheet.insertRule(r, sheet.cssRules.length);
  }
}

// Dynamic Style Sheet
// A dynamic style sheet is added to every window, which provides the following
// CSS classes potentially having any/all properties found in ConfigType. The
// stylesheet contains these CSS classes in this order:
//   .cs-<locale> { a class for each installed locale }
//   .cs-<module> { a class for each installed module }
//   .cs-Program { the current program locale class }
//   .cs-LTR_DEFAULT { the default LTR class which can be used for labels etc. }
// When class rules are created, user preferences, if set, are also added in
// the following order:
//   1) User preference defaults for each rule type (module, locale, LTR_DEFAULT, Program)
//   2) Config values
//   3) User preference values for each instance (of module or locale)
class DynamicStyleSheet {
  sheet: CSSStyleSheet | null;

  style: StyleType;

  constructor(doc: Document) {
    const style = doc.createElement('style');
    doc.head.appendChild(style);
    this.sheet = style.sheet;
    this.style = {
      locale: G.LocaleConfigs,
      module: {
        ...G.ModuleConfigs,
        default: G.ModuleConfigDefault,
      },
      program: { default: G.ProgramConfig },
    };
  }

  update(styleConfigs?: Partial<StyleType>) {
    const { sheet } = this;
    const prefStyleConfigs = G.Prefs.getPrefOrCreate('style', 'complex', {
      locale: {},
      module: {},
      program: {},
    }) as StyleType;
    const style = styleConfigs || prefStyleConfigs;
    const classPrefixes = ['cs'];
    if (sheet) {
      while (sheet.cssRules.length) {
        sheet.deleteRule(0);
      }
      classPrefixes.forEach((prefix) => {
        Object.entries(this.style).forEach((entry) => {
          const type = entry[0] as keyof StyleType;
          const configobj = entry[1];
          Object.entries(configobj).forEach((entry2) => {
            const [instance, config] = entry2;
            if (instance !== 'default') {
              insertRule(
                sheet,
                prefix,
                instance,
                getConfig(style, type, 'default')
              );
              insertRule(sheet, prefix, instance, config);
              insertRule(
                sheet,
                prefix,
                instance,
                getConfig(style, type, instance)
              );
            }
          });
        });
      });
      insertRule(
        sheet,
        'cs',
        'LTR_DEFAULT',
        getConfig(style, 'module', 'default')
      );
      Object.entries(G.FontFaceConfigs).forEach((entry) => {
        const [name, src] = entry;
        const rule = `@font-face {font-family:'${name}'; src:url("'${src}'");}`;
        sheet.insertRule(rule, sheet.cssRules.length);
      });
      console.log(sheet);
    }
  }
}

export default new DynamicStyleSheet(document);

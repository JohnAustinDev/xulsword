import G from './rg';

import type { ConfigType } from '../type';

// Dynamic Style Sheet
// A dynamic style sheet is added to every window, which provides the following
// CSS classes potentially having any/all properties listed in Config and user
// preferences. The stylesheet contains these CSS classes in this order:
//   .cs-<locale> { a class for each installed locale }
//   .cs-<module> { a class for each installed module }
//   .cs-LTR_DEFAULT { the default LTR class which can be used for labels etc. }
//   .cs-Program { the current program locale class }
// When class rules are created, user preferences, if set, are also added in
// the following order:
//   1) User preference defaults for each rule type (module, locale, LTR_DEFAULT, Program)
//   2) Config values
//   3) User preference values for each instance (of module or locale)
class DynamicStyleSheet {
  sheet: CSSStyleSheet | null;

  constructor(doc: Document) {
    const style = doc.createElement('style');
    doc.head.appendChild(style);
    this.sheet = style.sheet;
  }

  update() {
    const { sheet } = this;
    const configtypes: { [i: string]: { [i: string]: ConfigType } } = {
      locale: G.LocaleConfigs,
      module: G.ModuleConfigs,
      default: { ltrdefault: G.ModuleConfigDefault },
      program: { program: G.ProgramConfig },
    };
    const configProps: (keyof ConfigType)[] = ['StyleRule'];
    if (sheet) {
      Array.from(sheet.cssRules).forEach((_r, i) => sheet.deleteRule(i));
      configProps.forEach((configProp) => {
        Object.entries(configtypes).forEach((entry) => {
          const [type, configobj] = entry;
          const typerule = G.Prefs.getPrefOrCreate(
            `style.type.${type}`,
            'complex',
            null
          );
          Object.entries(configobj).forEach((entry2) => {
            const [instance, config] = entry2;
            if (typerule) sheet.insertRule(typerule, sheet.cssRules.length);
            const confrule = config[configProp];
            if (confrule) sheet.insertRule(confrule, sheet.cssRules.length);
            const instrule = G.Prefs.getPrefOrCreate(
              `style.instance.${instance}`,
              'complex',
              null
            );
            if (instrule) sheet.insertRule(instrule, sheet.cssRules.length);
          });
        });
      });
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

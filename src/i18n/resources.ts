import type { Language } from '../domain';

type Tree = { [key: string]: string | Tree };

/** One file per feature under `locales/<lang>/`; its name is the top-level key (`equipment.json` → `t('equipment.…')`). */
const files = import.meta.glob<Tree>('./locales/*/*.json', { eager: true, import: 'default' });

export const resources = {} as Record<Language, Record<string, Tree>>;
for (const [path, tree] of Object.entries(files)) {
  const match = /\.\/locales\/(\w+)\/([\w-]+)\.json$/.exec(path);
  if (!match) continue;
  const [, lang, name] = match as unknown as [string, Language, string];
  (resources[lang] ??= {})[name] = tree;
}

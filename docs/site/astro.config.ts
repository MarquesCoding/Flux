import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

const site = process.env.VALENCE_DOCS_SITE;

export default defineConfig({
  site: site === undefined || site === '' ? 'http://localhost:4321' : site,
  integrations: [
    starlight({
      title: 'Valence',
      description:
        'A self-hosted streaming platform with real plugin, API and documentation support.',
      sidebar: [
        { label: 'Start here', autogenerate: { directory: 'start' } },
        { label: 'Operating Valence', autogenerate: { directory: 'operate' } },
        { label: 'Building plugins', autogenerate: { directory: 'plugins' } },
      ],
    }),
  ],
});

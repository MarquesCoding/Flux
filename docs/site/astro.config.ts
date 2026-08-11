import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

const site = process.env.FLUX_DOCS_SITE;

export default defineConfig({
  site: site === undefined || site === '' ? 'http://localhost:4321' : site,
  integrations: [
    starlight({
      title: 'Flux',
      description:
        'A self-hosted streaming platform with real plugin, API and documentation support.',
      sidebar: [
        { label: 'Start here', autogenerate: { directory: 'start' } },
        { label: 'Operating Flux', autogenerate: { directory: 'operate' } },
        { label: 'Building plugins', autogenerate: { directory: 'plugins' } },
      ],
    }),
  ],
});

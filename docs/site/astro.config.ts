import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

export default defineConfig({
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
})

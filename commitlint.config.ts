import type { UserConfig } from '@commitlint/types'

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'chore',
        'docs',
        'refactor',
        'test',
        'perf',
        'build',
        'ci',
        'style',
        'revert',
      ],
    ],
    'scope-enum': [
      2,
      'always',
      ['web', 'server', 'transcoder', 'ui', 'contracts', 'plugin-sdk', 'docs', 'deps', 'repo'],
    ],
    'subject-case': [2, 'always', 'lower-case'],
  },
}

export default config

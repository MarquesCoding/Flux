import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'target/**',
      '**/.turbo/**',
      '**/.astro/**',
    ],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message:
                'Parent-relative imports are banned. Use @FluxUI/*, @FluxCore/*, @FluxContracts/* or @FluxSDK/*.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSUnknownKeyword',
          message: 'unknown is banned. Parse untrusted input through a Zod schema instead.',
        },
        {
          selector: 'TSAsExpression[typeAnnotation.typeName.name!="const"]',
          message:
            'Type assertions are banned. Parse untrusted input through a Zod schema instead.',
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    files: ['**/*.config.ts', '**/vitest.setup.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
)

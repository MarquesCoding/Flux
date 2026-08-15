import tseslint from 'typescript-eslint';
import { noComments } from './tools/eslint/noComments';

const flux = {
  rules: {
    'no-comments': noComments,
  },
};

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
    plugins: { flux },
    rules: {
      'flux/no-comments': 'error',
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
            {
              group: ['@tabler/icons-react'],
              message:
                'Icons come from @remixicon/react — see code standards section 10. Prefer the -line icon and its -fill twin for the active state.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXOpeningElement[name.name=/^(button|input|select|textarea|dialog)$/]',
          message:
            'Raw controls are banned. Compose Button, TextField, FilePicker or Dialog — see code standards section 9.',
        },
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
    files: [
      'packages/ui/src/components/Button/Button.tsx',
      'packages/ui/src/components/TextField/TextField.tsx',
      'packages/ui/src/components/FilePicker/FilePicker.tsx',
    ],
    rules: {
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
    files: ['**/*.config.ts', '**/vitest.setup.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
);

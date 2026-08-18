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
              group: ['@tabler/icons-react', '@remixicon/react', 'lucide-react'],
              message:
                'Icons come from @hugeicons/core-free-icons, drawn by @FluxUI/Icon — see code standards section 10.',
            },
            {
              group: ['@base-ui/react', '@base-ui/react/*'],
              message:
                'Base UI is for Dialog alone — see ADR-0021. Everything else in FluxUI is Radix.',
            },
            {
              group: ['@hugeicons/react'],
              importNames: ['HugeiconsIcon'],
              message:
                'Draw an icon with @FluxUI/Icon rather than the renderer, so the icon set stays swappable in one file.',
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
    files: [
      'packages/ui/src/components/Icon/Icon.tsx',
      'packages/ui/src/components/Dialog/Dialog.tsx',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['packages/client/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@FluxWeb/*'],
              message:
                'The application cannot reach into a client. Anything it needs from one is a port on Platform — see ADR-0022.',
            },
            {
              group: ['@FluxUI/*'],
              message:
                'The application does not draw. A component belongs to a client, and a shape both need belongs to @FluxContracts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/screens/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@FluxWeb/*'],
              message:
                'A screen cannot reach into a client. Anything it needs from one is a port on Platform — see ADR-0023.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.config.ts', '**/vitest.setup.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
);

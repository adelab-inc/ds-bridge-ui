import type { StorybookConfig } from '@storybook/react-webpack5';
import { join, dirname, resolve } from 'path';
import Dotenv from 'dotenv-webpack';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): string {
  return dirname(require.resolve(join(value, 'package.json')));
}

const config: StorybookConfig = {
  stories: [
    // 모노레포의 UI 패키지에서 스토리 파일들을 찾음
    '../../../packages/ui/src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],

  addons: [
    getAbsolutePath('@storybook/addon-webpack5-compiler-swc'),
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-onboarding'),
    getAbsolutePath('@storybook/addon-interactions'),
    getAbsolutePath('@storybook/addon-a11y'),
  ],

  framework: {
    name: getAbsolutePath('@storybook/react-webpack5'),
    options: {
      builder: {
        useSWC: true,
      },
    },
  },

  swc: () => ({
    jsc: {
      transform: {
        react: {
          runtime: 'automatic',
        },
      },
    },
  }),

  docs: {
    autodocs: 'tag',
  },

  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: prop => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },

  webpackFinal: async config => {
    // .env.local 파일 로드
    if (config.plugins) {
      config.plugins.push(
        new Dotenv({
          path: resolve(__dirname, '../../../../.env.local'), // 프로젝트 루트의 .env.local
          systemvars: true,
        })
      );
    }

    if (config.resolve) {
      // TsconfigPathsPlugin을 추가하여 tsconfig.json의 paths를 사용
      config.resolve.plugins = [
        ...(config.resolve.plugins || []),
        new TsconfigPathsPlugin({
          extensions: config.resolve.extensions,
        }),
      ];
    }

    // TailwindCSS PostCSS 설정 추가
    const cssRule = config.module?.rules?.find(
      rule => rule && typeof rule === 'object' && 'test' in rule && rule.test?.toString().includes('css')
    );

    if (cssRule && typeof cssRule === 'object' && 'use' in cssRule) {
      const postCssLoader = {
        loader: 'postcss-loader',
        options: {
          postcssOptions: {
            plugins: [require('tailwindcss'), require('autoprefixer')],
          },
        },
      };

      if (Array.isArray(cssRule.use)) {
        cssRule.use.push(postCssLoader);
      }
    }

    return config;
  },
};

export default config;

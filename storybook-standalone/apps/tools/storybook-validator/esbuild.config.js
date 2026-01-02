/**
 * esbuild 번들링 설정
 * MCP Extension을 단일 bundle.js로 패키징
 */
import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');
const isMinify = process.argv.includes('--minify');

/** @type {esbuild.BuildOptions} */
const config = {
  entryPoints: ['src/mcp-entry.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/bundle.js',
  minify: isMinify,
  sourcemap: !isMinify,
  external: [],
  define: {
    'process.env.NODE_ENV': isMinify ? '"production"' : '"development"',
  },
};

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(config);
      await ctx.watch();
      console.log('👀 Watching for changes...');
    } else {
      await esbuild.build(config);
      console.log('✅ Build completed: dist/bundle.js');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();

/**
 * @aplus/ui UMD 번들 빌드 설정
 *
 * DS-Runtime Hub에서 iframe 내 React 코드 렌더링을 위한 UMD 번들 생성
 *
 * 사용법:
 *   pnpm build:umd
 *
 * 출력:
 *   dist/ui.umd.js - UMD 번들 (window.AplusUI로 접근)
 */

import * as esbuild from "esbuild";

await esbuild.build({
  // 엔트리 포인트
  entryPoints: ["src/index.ts"],

  // 번들링 활성화
  bundle: true,

  // UMD 호환 IIFE 형식 (브라우저 전역 변수로 노출)
  format: "iife",
  globalName: "AplusUI",

  // 출력 파일
  outfile: "dist/ui.umd.js",

  // React는 플러그인에서 window 전역 변수로 매핑
  // external 대신 플러그인으로 처리 (IIFE에서 require 문제 방지)

  // 프로덕션 빌드 설정
  minify: true,
  sourcemap: true,

  // 타겟 브라우저
  target: ["es2020"],

  // JSX 설정 (classic 모드 - React.createElement 사용)
  jsx: "transform",

  // 로더 설정
  loader: {
    ".tsx": "tsx",
    ".ts": "ts",
  },

  // 경고를 에러로 처리하지 않음
  logLevel: "info",

  // 플러그인 설정
  plugins: [
    // React, ReactDOM을 window 전역 변수로 매핑
    {
      name: "react-shim",
      setup(build) {
        // react 모듈을 window.React로 매핑
        build.onResolve({ filter: /^react$/ }, () => ({
          path: "react",
          namespace: "react-shim",
        }));

        build.onLoad({ filter: /.*/, namespace: "react-shim" }, () => ({
          contents: `module.exports = window.React;`,
          loader: "js",
        }));

        // react-dom 모듈을 window.ReactDOM으로 매핑
        build.onResolve({ filter: /^react-dom$/ }, () => ({
          path: "react-dom",
          namespace: "react-dom-shim",
        }));

        build.onLoad({ filter: /.*/, namespace: "react-dom-shim" }, () => ({
          contents: `module.exports = window.ReactDOM;`,
          loader: "js",
        }));

        // react/jsx-runtime을 React.createElement로 매핑
        build.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({
          path: "react/jsx-runtime",
          namespace: "jsx-runtime-shim",
        }));

        build.onLoad({ filter: /.*/, namespace: "jsx-runtime-shim" }, () => ({
          contents: `
            const React = window.React;
            export const jsx = (type, props, key) => {
              const { children, ...rest } = props || {};
              return React.createElement(type, key !== undefined ? { ...rest, key } : rest, children);
            };
            export const jsxs = jsx;
            export const jsxDEV = jsx;
            export const Fragment = React.Fragment;
          `,
          loader: "js",
        }));
      },
    },
    // ag-grid, ag-charts, lottie-react stub 처리
    {
      name: "externalize-heavy-deps",
      setup(build) {
        build.onResolve(
          { filter: /^ag-grid|^ag-charts|^lottie-react/ },
          (args) => ({
            path: args.path,
            namespace: "external-stub",
          })
        );

        build.onLoad({ filter: /.*/, namespace: "external-stub" }, (args) => {
          let contents = "";

          if (args.path.includes("ag-charts")) {
            contents = `
              export const AgCharts = () => null;
              export const AgChartReact = () => null;
              export default {};
            `;
          } else if (args.path.includes("ag-grid-community")) {
            contents = `
              export const ModuleRegistry = { registerModules: () => {} };
              export const AllCommunityModule = {};
              export default {};
            `;
          } else if (args.path.includes("ag-grid-react")) {
            contents = `
              export const AgGridReact = () => null;
              export default {};
            `;
          } else if (args.path.includes("lottie-react")) {
            contents = `
              const Lottie = () => null;
              export default Lottie;
            `;
          } else {
            contents = `export default {};`;
          }

          return { contents, loader: "js" };
        });
      },
    },
  ],
});

console.log("UMD bundle created: dist/ui.umd.js");

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

  // React는 외부 의존성으로 (CDN에서 로드)
  external: ["react", "react-dom", "react/jsx-runtime"],

  // React 전역 변수 매핑
  // CDN에서 React를 로드하면 window.React, window.ReactDOM으로 접근
  banner: {
    js: `
// React 전역 변수 매핑 (CDN 로드용)
const React = window.React;
const ReactDOM = window.ReactDOM;
`,
  },

  // 프로덕션 빌드 설정
  minify: true,
  sourcemap: true,

  // 타겟 브라우저
  target: ["es2020"],

  // JSX 설정
  jsx: "automatic",

  // 로더 설정
  loader: {
    ".tsx": "tsx",
    ".ts": "ts",
  },

  // 경고를 에러로 처리하지 않음
  logLevel: "info",

  // ag-grid, ag-charts는 외부 의존성으로 (필요시 별도 로드)
  // Chart, DataGrid 컴포넌트 사용 시 별도 CDN 로드 필요
  plugins: [
    {
      name: "externalize-heavy-deps",
      setup(build) {
        // ag-grid, ag-charts, lottie-react 관련 import를 빈 모듈로 대체
        build.onResolve(
          { filter: /^ag-grid|^ag-charts|^lottie-react/ },
          (args) => {
            return {
              path: args.path,
              namespace: "external-stub",
            };
          }
        );

        build.onLoad({ filter: /.*/, namespace: "external-stub" }, (args) => {
          // 각 패키지별로 필요한 stub exports 제공
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

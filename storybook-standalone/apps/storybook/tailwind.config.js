/** @type {import('tailwindcss').Config} */
// 자동 생성된 파일이 아닙니다. 필요에 따라 수정하세요.

module.exports = {
  presets: [require('../../packages/ui/tailwind.preset.js')],
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/design-tokens/component-definitions.json',
  ],
};

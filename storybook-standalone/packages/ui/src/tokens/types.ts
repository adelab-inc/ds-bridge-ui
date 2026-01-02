// 📝 디자인 토큰 TypeScript 타입 정의
// 자동 생성된 파일입니다. 직접 수정하지 마세요.

import { designTokens } from './design-tokens';

// 🎯 기본 토큰 타입들
export type FontSize = keyof typeof designTokens.fontSize;
export type Colors = keyof typeof designTokens.colors;
export type Spacing = keyof typeof designTokens.spacing;
export type FontWeight = keyof typeof designTokens.fontWeight;
export type FontFamily = keyof typeof designTokens.fontFamily;

// 🛠️ 유틸리티 타입들
export type ClassName = string | undefined | null | false;
export type ClassNameArray = ClassName[];
export type ClassValue = ClassName | ClassNameArray | Record<string, boolean>;

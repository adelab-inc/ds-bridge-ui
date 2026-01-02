// 🛠️ CVA 컴포넌트 유틸리티 함수
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines clsx and tailwind-merge for optimal className handling
 *
 * Features:
 * - clsx: conditional classes, arrays, objects
 * - twMerge: resolves Tailwind CSS class conflicts
 *
 * Usage:
 * cn("px-4 py-2", { "bg-blue-500": isActive }, "text-white")
 * cn(["flex", "items-center"], className)
 */
export function cn(...inputs: ClassValue[]) {
  const merged = clsx(inputs);
  // text-로 시작하는 클래스는 twMerge의 충돌 해결 로직을 우회
  // (tailwind-merge가 bg-와 text-를 같은 그룹으로 오인하여 text-를 제거하는 문제 해결)
  if (merged.includes('text-')) {
    return merged;
  }
  return twMerge(merged);
}

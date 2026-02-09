import * as React from 'react';

/**
 * Controlled/Uncontrolled 상태를 자동으로 처리하는 훅
 *
 * @param controlledValue - 외부에서 제어하는 값 (Controlled 모드)
 * @param defaultValue - 초기값 (Uncontrolled 모드)
 * @param onChange - 값 변경 시 콜백
 * @returns [현재 값, 값 변경 함수]
 *
 * @example
 * // Uncontrolled 모드 (defaultValue만 전달)
 * const [value, setValue] = useControllableState(undefined, new Set(['a']));
 *
 * @example
 * // Controlled 모드 (controlledValue 전달)
 * const [value, setValue] = useControllableState(externalValue, new Set(), onExternalChange);
 */
export function useControllableState<T>(
  controlledValue: T | undefined,
  defaultValue: T,
  onChange?: (value: T) => void
): [T, (value: T | ((prev: T) => T)) => void] {
  // Controlled 여부는 초기 마운트 시점의 값으로 결정
  // (런타임에 모드 전환 방지)
  const isControlled = controlledValue !== undefined;

  // Uncontrolled 모드에서만 사용되는 내부 상태
  const [internalValue, setInternalValue] = React.useState<T>(defaultValue);

  // 실제 사용되는 값
  const value = isControlled ? controlledValue : internalValue;

  // 통합 setter
  const setValue = React.useCallback(
    (nextValue: T | ((prev: T) => T)) => {
      // 함수 형태의 업데이트 지원
      const resolvedValue =
        typeof nextValue === 'function'
          ? (nextValue as (prev: T) => T)(value)
          : nextValue;

      // Uncontrolled 모드: 내부 상태 업데이트
      if (!isControlled) {
        setInternalValue(resolvedValue);
      }

      // 콜백 호출 (Controlled/Uncontrolled 모두)
      onChange?.(resolvedValue);
    },
    [isControlled, value, onChange]
  );

  return [value, setValue];
}

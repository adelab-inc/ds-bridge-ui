import { useCallback, useRef } from 'react';

import {
  openPopup as openPopupUtil,
  type PopupOptions,
  type PopupEventHandlers,
  type PopupResult,
} from '../utils/popup';

export interface UsePopupConfig<T = unknown> {
  url: string;
  name: string;
  options?: PopupOptions;
  initialData?: T;
}

export interface UsePopupOptions {
  /** 기본 팝업 옵션 (모든 팝업에 적용) */
  defaultOptions?: PopupOptions;
}

export interface UsePopupReturn<T = unknown> {
  /**
   * 팝업을 엽니다.
   *
   * @example
   * ```tsx
   * const handleClick = () => {
   *   const { sendData } = open({
   *     url: '/popup/detail',
   *     name: 'detail',
   *     onComplete: (data) => console.log(data),
   *   });
   *   sendData({ userId: 123 });
   * };
   *
   * <button onClick={() => open({ url: '...', name: '...' })}>
   * ```
   */
  open: (config: UsePopupConfig<T> & PopupEventHandlers<T>) => PopupResult<T>;

  /**
   * 현재 열린 팝업에 데이터를 전송합니다.
   */
  sendData: (data: T) => void;

  /**
   * 현재 열린 팝업을 닫습니다.
   */
  close: () => void;
}

/**
 * 팝업 창 관리를 위한 React 훅
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { open } = usePopup<ResponseType>({ defaultOptions: { width: 670 } });
 *
 *   return (
 *     <button onClick={() => open({
 *       url: '/popup/search',
 *       name: 'searchPopup',
 *       onComplete: (data) => console.log('선택된 데이터:', data),
 *       onClose: () => console.log('팝업 닫힘'),
 *     })}>
 *       검색 팝업 열기
 *     </button>
 *   );
 * }
 * ```
 */
export function usePopup<T = unknown>(options?: UsePopupOptions): UsePopupReturn<T> {
  const { defaultOptions } = options ?? {};
  const popupRef = useRef<PopupResult<T> | null>(null);

  const open = useCallback(
    (config: UsePopupConfig<T> & PopupEventHandlers<T>): PopupResult<T> => {
      const {
        url,
        name,
        options: configOptions,
        initialData,
        ...handlers
      } = config;

      const result = openPopupUtil<T>({
        url,
        name,
        initialData,
        options: {
          ...defaultOptions,
          ...configOptions,
        },
        ...handlers,
      });

      popupRef.current = result;
      return result;
    },
    [defaultOptions]
  );

  const sendData = useCallback((data: T) => {
    popupRef.current?.sendData(data);
  }, []);

  const close = useCallback(() => {
    popupRef.current?.window?.close();
    popupRef.current = null;
  }, []);

  return {
    open,
    sendData,
    close,
  };
}

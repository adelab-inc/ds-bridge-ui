/**
 * 팝업 창 관리 유틸리티
 * - 부모-자식 창 간 postMessage 통신
 * - 타입 안전한 이벤트 핸들링
 */

export interface PopupOptions {
  width?: number;
  height?: number;
  left?: number | 'center';
  top?: number | 'center';
  resizable?: boolean;
  scrollbars?: boolean;
  status?: boolean;
  menubar?: boolean;
  toolbar?: boolean;
}

// 이벤트 타입 정의
export type PopupEventType = 'complete' | 'close' | 'error' | 'search' | 'resize' | 'data';

// 이벤트별 데이터 타입
export interface PopupCompleteData<T = unknown> {
  type: 'complete';
  data: T;
}

export interface PopupErrorData {
  type: 'error';
  error: Error | string;
}

export interface PopupSearchData<T = unknown> {
  type: 'search';
  query: string;
  results?: T[];
}

export interface PopupParentData<T = unknown> {
  type: 'data';
  data: T;
}

export type PopupEventData<T = unknown> =
  | PopupCompleteData<T>
  | PopupErrorData
  | PopupSearchData<T>
  | PopupParentData<T>;

// 이벤트 핸들러 인터페이스
export interface PopupEventHandlers<T = unknown> {
  onComplete?: (data: T) => void;
  onError?: (error: Error | string) => void;
  onSearch?: (query: string, results?: T[]) => void;
  onClose?: () => void;
  onResize?: () => void;
  onMessage?: (data: PopupEventData<T>) => void;
}

export interface PopupParams<T = unknown> extends PopupEventHandlers<T> {
  url: string;
  name?: string;
  options?: PopupOptions;
  initialData?: T;
}

export interface PopupResult<T = unknown> {
  window: Window | null;
  sendData: (data: T) => void;
}

/**
 * 팝업 창을 열고 이벤트 핸들러를 설정합니다.
 *
 * @example
 * ```tsx
 * const { window: popup, sendData } = openPopup({
 *   url: '/popup/detail',
 *   name: 'detailPopup',
 *   options: { width: 800, height: 600 },
 *   onComplete: (data) => console.log('완료:', data),
 *   onClose: () => console.log('팝업 닫힘'),
 * });
 *
 * // 팝업에 데이터 전송
 * sendData({ userId: 123 });
 * ```
 */
export function openPopup<T = unknown>({
  url,
  name = '_blank',
  options,
  initialData,
  onComplete,
  onError,
  onSearch,
  onClose,
  onResize,
  onMessage,
}: PopupParams<T>): PopupResult<T> {
  // SSR 가드
  if (typeof window === 'undefined') {
    return {
      window: null,
      sendData: () => {},
    };
  }

  // 기본 옵션 설정
  const windowOptions: PopupOptions = {
    width: 800,
    height: 600,
    left: 0,
    top: 0,
    resizable: true,
    scrollbars: true,
    status: false,
    menubar: false,
    toolbar: false,
    ...options,
  };

  // 중앙 배치 처리
  if (windowOptions.left === 'center' && windowOptions.width) {
    windowOptions.left = Math.round((window.screen.width - windowOptions.width) / 2);
  }
  if (windowOptions.top === 'center' && windowOptions.height) {
    windowOptions.top = Math.round((window.screen.height - windowOptions.height) / 2);
  }

  // 옵션 문자열 생성
  const optionsStr = Object.entries(windowOptions)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');

  // 팝업 창 열기
  const popupWindow = window.open(url, name, optionsStr);

  // 메시지 큐 (POPUP_READY 전 메시지 보관)
  const queued: T[] = [];
  let isReady = false;

  const flush = () => {
    while (queued.length && popupWindow && !popupWindow.closed) {
      const payload = queued.shift();
      popupWindow.postMessage({ type: 'data', data: payload }, location.origin);
    }
  };

  // 자식 창으로 데이터 전송
  const sendData = (data: T) => {
    if (!popupWindow || popupWindow.closed) return;
    if (isReady) {
      popupWindow.postMessage({ type: 'data', data }, location.origin);
    } else {
      queued.push(data);
    }
  };

  // 이벤트 리스너 설정
  if (popupWindow && (onComplete || onError || onSearch || onClose || onResize || onMessage)) {
    const messageHandler = (event: MessageEvent) => {
      // 출처 검증
      if (event.source !== popupWindow || event.origin !== location.origin) {
        return;
      }

      // POPUP_READY 핸드셰이크
      if (event.data?.type === 'POPUP_READY') {
        isReady = true;
        flush();
        return;
      }

      // 이벤트 처리
      try {
        if (typeof event.data === 'object' && event.data !== null) {
          const eventData = event.data as PopupEventData<T>;

          // 통합 콜백
          onMessage?.(eventData);

          // 개별 콜백
          switch (eventData.type) {
            case 'complete':
              onComplete?.(eventData.data);
              break;
            case 'error':
              onError?.(eventData.error);
              break;
            case 'search':
              onSearch?.(eventData.query, eventData.results);
              break;
          }
        }
      } catch (error) {
        console.error('팝업 이벤트 처리 오류:', error);
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    };

    window.addEventListener('message', messageHandler);

    // 팝업 닫힘 감지
    const checkClosed = setInterval(() => {
      if (popupWindow?.closed) {
        window.removeEventListener('message', messageHandler);
        clearInterval(checkClosed);
        onClose?.();
      }
    }, 500);

    // 초기 데이터 전송
    if (initialData !== undefined) {
      sendData(initialData);
    }
  }

  return {
    window: popupWindow,
    sendData,
  };
}

/**
 * 팝업에서 부모 창으로 완료 데이터 전송
 */
export function sendCompleteToParent<T = unknown>(data: T): void {
  sendEventToParent({ type: 'complete', data });
}

/**
 * 팝업에서 부모 창으로 오류 전송
 */
export function sendErrorToParent(error: Error | string): void {
  sendEventToParent({ type: 'error', error });
}

/**
 * 팝업에서 부모 창으로 검색 결과 전송
 */
export function sendSearchToParent<T = unknown>(query: string, results?: T[]): void {
  sendEventToParent({ type: 'search', query, results });
}

/**
 * 팝업에서 부모 창으로 이벤트 전송 (내부용)
 */
export function sendEventToParent<T = unknown>(eventData: PopupEventData<T>): void {
  if (typeof window === 'undefined') return;

  const target = window.opener ?? (window.parent !== window.self ? window.parent : null);
  target?.postMessage(eventData, location.origin);
}

/**
 * 팝업에서 부모 창의 메시지를 수신하는 리스너 등록
 *
 * @returns cleanup 함수 (useEffect에서 사용)
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   return listenToParentMessages((data) => {
 *     console.log('부모에서 받은 데이터:', data);
 *   });
 * }, []);
 * ```
 */
export function listenToParentMessages<T = unknown>(callback: (data: T) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const messageHandler = (event: MessageEvent) => {
    if (event.origin !== location.origin) return;
    if (typeof event.data === 'object' && event.data?.type === 'data') {
      callback(event.data.data as T);
    }
  };

  // 준비 완료 알림
  postReadyToParent();

  window.addEventListener('message', messageHandler);

  return () => {
    window.removeEventListener('message', messageHandler);
  };
}

/**
 * 팝업이 준비되었음을 부모 창에 알림
 */
export function postReadyToParent(): void {
  if (typeof window === 'undefined') return;

  const target = window.opener ?? (window.parent !== window.self ? window.parent : null);
  target?.postMessage({ type: 'POPUP_READY' }, location.origin);
}

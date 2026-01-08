"use client"

import * as React from "react"

interface ClientOnlyProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * 클라이언트에서만 렌더링되는 래퍼 컴포넌트
 * SSR에서 Hydration mismatch를 방지하기 위해 사용
 *
 * Base UI 컴포넌트들이 React 19의 useId()를 사용하여
 * 서버/클라이언트 간 ID 불일치가 발생할 때 이 컴포넌트로 감싸면 해결됨
 */
function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = React.useState(false)

  React.useEffect(() => {
    setHasMounted(true)
  }, [])

  if (!hasMounted) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

export { ClientOnly }
export type { ClientOnlyProps }

import * as React from "react"

const MOBILE_BREAKPOINT = 768
/** Matches Tailwind `lg` — desktop hub chrome / 300×250 ads. */
const DESKTOP_LG_BREAKPOINT = 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

/** `null` until mounted so callers can avoid loading the wrong ad unit. */
export function useIsDesktopLg(): boolean | null {
  const [isDesktop, setIsDesktop] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_LG_BREAKPOINT}px)`)
    const onChange = () => setIsDesktop(mql.matches)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isDesktop
}

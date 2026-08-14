'use client'

import { useCallback, useEffect, useRef } from 'react'

import { TOUR_STEPS } from './tour-steps'

/**
 * The product tour. It NEVER starts by itself.
 *
 * There is no "first visit" branch and no `localStorage` flag, and that is a decision rather
 * than an omission: the end-to-end suite sets no storage state and reseeds only the database,
 * so every spec starts with an empty `localStorage`. A first-visit tour would therefore have
 * opened over all five specs and blocked their first click — the flag meant to suppress it had
 * nowhere to be written.
 *
 * Two ways in, both requiring a person: the header button, and `?tour=1` for demoing.
 *
 * driver.js is loaded with `import()` at the moment it is needed, so neither the library nor
 * its stylesheet lands in the first-load bundle of a screen that will usually never show it.
 */
export function useProductTour() {
  const started = useRef(false)

  const start = useCallback(async () => {
    const [{ driver }] = await Promise.all([import('driver.js'), import('driver.js/dist/driver.css')])

    /**
     * Steps whose anchor is not on this screen are turned into centred, unanchored steps
     * instead of being dropped. driver.js skips a missing anchor SILENTLY, which would quietly
     * turn six steps into four depending on which page the tour was opened from — and nobody
     * would notice until a judge counted.
     */
    const steps = TOUR_STEPS.map((step) => {
      const element = step.anchor ? document.querySelector(`[data-tour="${step.anchor}"]`) : null
      return {
        ...(element ? { element: element as Element } : {}),
        popover: {
          title: step.title,
          description: element
            ? step.description
            : `${step.description}\n\n(Phần này nằm ở màn khác — mở màn đó để xem tận nơi.)`,
        },
      }
    })

    driver({
      steps,
      showProgress: true,
      nextBtnText: 'Tiếp',
      prevBtnText: 'Quay lại',
      doneBtnText: 'Xong',
      progressText: 'Bước {{current}}/{{total}}',
      // Escape and the overlay both close it; nothing here traps a reader inside the tour.
      allowClose: true,
    }).drive()
  }, [])

  /**
   * `?tour=1` runs once per page load. The ref stops React's re-renders from restarting a tour
   * the reader is already halfway through.
   *
   * The query string is read off `location` inside the effect rather than with
   * `useSearchParams()`. That hook opts every page rendering this header out of static
   * prerendering unless each one wraps it in its own `<Suspense>` — and the build says so by
   * failing, which is how this was found. Reading it here keeps the header a plain component
   * and the pages static.
   */
  useEffect(() => {
    if (started.current) return
    if (new URLSearchParams(window.location.search).get('tour') !== '1') return
    started.current = true
    void start()
  }, [start])

  return start
}

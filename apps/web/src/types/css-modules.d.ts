/**
 * Lets a plain stylesheet be pulled in with `import()` alongside the module that needs it.
 *
 * This exists so `driver.js` and its CSS can both stay OUT of the first-load bundle: the tour
 * is opened by a button most sessions never press, and a library plus stylesheet shipped to
 * every page for that is a cost paid by everyone for a feature used by few. TypeScript has no
 * type for a `.css` import, so it is declared once here rather than silenced at each call site.
 */
declare module '*.css' {
  const stylesheet: string
  export default stylesheet
}

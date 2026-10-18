/**
 * Shared SVG post-processing filters, mounted once at the app root:
 *  - `#fx-chromatic`: splits red and blue channels sideways (chromatic aberration)
 *  - `#fx-bloom`: blurs a brightened copy and screens it over the source (bloom)
 * Elements opt in briefly via CSS (`filter: url(#fx-chromatic)`), since SVG
 * filters on large areas are costly on phones.
 */
export function FxDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
      <defs>
        <filter id="fx-chromatic" x="-4%" y="-4%" width="108%" height="108%" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
          <feOffset in="red" dx="-5" dy="0" result="redShift" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
          <feOffset in="blue" dx="5" dy="0" result="blueShift" />
          <feBlend in="redShift" in2="green" mode="screen" result="rg" />
          <feBlend in="rg" in2="blueShift" mode="screen" />
        </filter>
        <filter id="fx-bloom" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1.6 0 0 0 -0.25  0 1.6 0 0 -0.25  0 0 1.6 0 -0.25  0 0 0 1 0" result="bright" />
          <feGaussianBlur in="bright" stdDeviation="7" result="blur" />
          <feBlend in="SourceGraphic" in2="blur" mode="screen" />
        </filter>
      </defs>
    </svg>
  )
}

# Maison Surga — visual rebuild

Static, responsive brand preview in British English. Open `index.html` directly, or serve this directory with any static server. The existing GitHub Pages workflow is preserved; a push to main publishes the site.

## Implemented

Home, facial-cleansing product preview, three category pages, brand story and launch information. Original SVG monogram and wordmark, five optimised editorial images, locally hosted fonts, keyboard-accessible modal search/account/bag, mobile navigation, swipeable product gallery, reduced-motion support and internal UTM propagation.

The collection is pre-launch. There is no payment flow, invented price, product certification, customer review, shipping promise or fake newsletter submission. Account and bag dialogs explain availability. Product imagery is AI-created and disclosed as illustrative. Replace imagery with verified product photography before enabling sales.

## Verification

28 page/viewport checks at 1440, 768, 390 and 320px. No horizontal overflow, broken images or page JavaScript errors. All internal links and anchors validated. Menu, live search, dialog closing, bag, gallery, product accordions and UTM propagation verified. Home screenshots at desktop and mobile visually reviewed.

## Commerce handoff

`window.maisonSurga` exposes an inactive event adapter for ViewContent, AddToCart, InitiateCheckout and Purchase. No pixel or analytics requests are sent. Wire verified catalogue and cart data, approved privacy/consent behaviour and real checkout before enabling commerce. Purchase belongs only in verified order confirmation. The GBP setting is preparatory; no amount is currently published.

## Assets

Original SVG logo and monogram are in `assets/`. Photography was generated with the built-in ImageGen tool, then resized and encoded to WebP. Total campaign image payload is approximately 483 KB. Google Fonts DM Sans and Instrument Serif are bundled with their SIL Open Font Licences.

Final generation prompt set, condensed without changing creative direction:

- Hero: premium photorealistic beauty campaign in a warm ivory/blush spa; adult woman with swept-back brown hair, gentle foam and blush cleansing brush; matching standing brush on travertine; soft left negative space; no text, logos or UI.
- Still life: ivory gift box, amber pump bottle, folded cream towels, olive branch and candle on marble; warm morning light; empty box face; no text, logos or collage.
- Brush: pale blush round-bristled cleansing brush, subtle rose-gold ring, power button, droplets, cream travertine plinth and soft studio light; no text or logos.
- Hair: tortoiseshell brush with gold pins on flowing brunette hair, blush silk background and warm editorial light; no text, logos or UI.
- Tools: rose quartz gua sha and pale pink roller with discreet rose-gold handle on blush ivory stone; soft natural shadows and empty space; no text or logos.

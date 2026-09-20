# Ring Studio (v1 prototype)

Parametric wedding / engagement ring configurator. Live 3D render in the browser with Three.js - procedural geometry only, no AI images, no build step, no dependencies beyond the three.js CDN.

## What it does

- **Parametric ring**: metal (yellow/white/rose gold, platinum), band profile (flat, court, bevelled), band width (mm), US ring size, stone shape (round, oval, princess, emerald, pear), stone size (carat), setting (solitaire prong, halo, bezel, pave band).
- **Live 3D**: physically-based metal shading, transmissive faceted stones, orbit/zoom, auto-rotate. Mobile-friendly layout.
- **Where to buy**: maps the selected shape + carat to real filtered search deeplinks at James Allen, Blue Nile and Brilliant Earth, with an indicative lab-grown price range (guide figures, not live quotes).

## Run it

Static site - serve the folder or open `index.html` over HTTP. Hosted via GitHub Pages.

## v2 ideas

- Live diamond inventory feeds (RapNet / Nivoda APIs), real-time prices
- Affiliate program enrollment (Blue Nile `a_aid`/`a_bid`, Brilliant Earth) and tracked outbound links
- Lead capture (email the configuration), saved designs, shareable URLs
- Ring try-on (AR), engraving preview, wedding-band matching sets

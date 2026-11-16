# Doji Portal

An animated black-hole visual built with raw WebGL 2 (no framework, no build step).

Thousands of tiny dots fall in a thin line through a gravitational lens. Several dot layers at different depths each bend into their own ring, so together they fill the disc. A separate front line runs through its own smaller warp.

## Run it

Open `index.html` in Chrome, Edge or Safari. That's it.

If your browser blocks loading local files, serve the folder:

```
npx serve .
```

## Files

- `index.html` – the page and control panel
- `style.css` – panel styling
- `portal-core.js` – the WebGL shader (in the `FRAG` string), GL setup, the cursor lens and the embed runtime. The editor and the exported code both run this file, so they always match.
- `main.js` – controls, presets, camera and export

## Mouse

The cursor carries its own small mass that bends the dot streams with the same lens as the hole: rings bulge around it, a stream behind it splits into arcs, and each depth layer bends by its own amount. Mass sets how strong it is, Scatter how ragged and loose the arcs around it are (0 is a clean bullseye), Lag how slowly it follows the pointer. It fades in when the pointer enters and out when it leaves. Exports are rendered without it.

## Export code

Export with the format set to Code to get one self-contained `.html` file for a developer: the current look, the shader and the cursor lens, without the editor. Open it to see it running, or paste its `<div class="doji-portal">` and `<script>` into a landing page. The portal fills that div, so size the div with CSS. `DojiPortal.mount(element, overrides)` mounts one from code and returns `{ destroy() }`.

## Export

PNG, GIF, MP4 and Code export are built in, and PNG and Code can have a transparent background. Every exported file carries the settings it was made with, and "Import settings" restores them (it also takes a .json of what "Copy settings" copies, and an exported code file).

GIF export loads `gifenc` and MP4 export loads `mp4-muxer` from jsDelivr on demand, so those need an internet connection.

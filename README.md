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
- `portal-core.js` – the WebGL shader (in the `FRAG` string), GL setup, the mouse disturbance and the embed runtime. The editor and the exported code both run this file, so they always match.
- `main.js` – controls, presets, camera and export

## Mouse

Moving the cursor over the portal drags the flow along with it, and the flow settles back when the cursor stops. The Mouse section sets how hard it pushes (Strength), how wide the push is (Size) and how long it takes to settle (Settle). Exports are rendered without it.

## Export code

Export with the format set to Code to get one self-contained `.html` file for a developer: the current look, the shader and the mouse disturbance, without the editor. Open it to see it running, or paste its `<div class="doji-portal">` and `<script>` into a landing page. The portal fills that div, so size the div with CSS. `DojiPortal.mount(element, overrides)` mounts one from code and returns `{ destroy() }`.

## Export

PNG, GIF, MP4 and Code export are built in, and PNG and Code can have a transparent background. Every exported file carries the settings it was made with, and "Import settings" restores them (it also takes a .json of what "Copy settings" copies, and an exported code file).

GIF export loads `gifenc` and MP4 export loads `mp4-muxer` from jsDelivr on demand, so those need an internet connection.

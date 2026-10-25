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
- `main.js` – the WebGL shader (in the `FRAG` string), controls, presets, camera and export

## Export

PNG, GIF and MP4 export are built in, and PNG can have a transparent background. Every exported file carries the settings it was made with, and "Import settings" restores them (it also takes a .json of what "Copy settings" copies).

GIF export loads `gifenc` and MP4 export loads `mp4-muxer` from jsDelivr on demand, so those need an internet connection.

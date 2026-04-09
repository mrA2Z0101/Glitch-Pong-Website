# Glitch Pong Website Build

This folder contains a standalone website version of your Glitch Pong project.

## Files
- `index.html` — landing page + launch buttons
- `styles.css` — website styling
- `glitchpong-site.js` — standalone launcher plus your original game logic adapted from `popup.js`
- `assets/` — menu art, paddles, countdown images
- `sounds/` — game audio
- `icons/` — favicon assets

## How to test locally
Because browsers restrict some media/file behavior on raw `file://` pages, test with a local web server.

### Python
```bash
cd glitchpong-website
python -m http.server 8000
```

Then open:
`http://localhost:8000`

## Hosting
You can host this on:
- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages
- Your own domain after deployment

## Notes
This version keeps the real Glitch Pong game logic and swaps extension-only asset loading for normal website paths.

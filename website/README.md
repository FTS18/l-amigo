# L'Amigo Website

Elegant landing page and documentation for the L'Amigo Chrome extension.

## Files

- `index.html` - Main landing page with hero, features, and CTA
- `docs.html` - Comprehensive documentation with sidebar navigation
- `privacy.html` - Privacy policy (GDPR-friendly, transparent)
- `terms.html` - Terms of service (legal protection)
- `styles.css` - Shared styles (modern, gradient-heavy, responsive)
- `script.js` - Smooth scrolling, mobile nav, fade-in animations

## Features

- 🎨 **Premium Design**: Gradient accents, smooth animations, glassmorphism nav
- 📱 **Fully Responsive**: Mobile-first with collapsible navigation
- ⚡ **Fast & Lightweight**: Pure HTML/CSS/JS, no frameworks
- 🔒 **Legally Sound**: Complete privacy policy and ToS
- ♿ **Accessible**: Semantic HTML, ARIA labels, keyboard navigation
- 🌐 **SEO Optimized**: Meta tags, semantic structure

## Deployment

### GitHub Pages
1. Push to repo
2. Settings → Pages → Source: `main` branch → `/website` folder
3. Your site is live at `https://yourusername.github.io/lamigo/`

### Netlify
1. Drag and drop the `website` folder to Netlify
2. Or connect GitHub repo with build command: `npm run build` and publish directory: `website`

### Custom Domain
Add a `CNAME` file with your domain name.

## Customization

- **Colors**: Edit CSS variables in `:root` (lines 8-24 of `styles.css`)
- **Content**: Update HTML directly (all text is inline)
- **Links**: Replace `#` placeholders with actual Chrome Web Store URL, GitHub repo, etc.
- **Images**: Add screenshots to `website/assets/` and replace `.screenshot-placeholder` divs

## Browser Compatibility

- Chrome 88+
- Firefox 78+
- Safari 14+
- Edge 88+

---

Built with ❤️ for the coding community

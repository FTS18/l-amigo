# L'Amigo Marketing and Documentation Infrastructure

This directory contains the primary web-facing infrastructure for L'Amigo, including the product landing page, technical documentation, and regulatory compliance disclosures. The infrastructure is designed as a high-performance, framework-less static site to ensure maximum speed and optimal search engine visibility.

## Asset Pipeline and Directory Structure

- **index.html**: The primary entry point and product showcase. It utilizes advanced CSS Grid and Flexbox layouts to provide a responsive, high-fidelity landing experience.
- **docs.html**: The centralized documentation hub. It provides an optimized reading experience for technical guides, integration walkthroughs, and API descriptions.
- **privacy.html** & **terms.html**: Standard legal disclosures required for Chrome Web Store distribution and regulatory compliance.
- **sitemap.xml**: A machine-readable map of the site architecture to facilitate efficient search engine crawling.
- **robots.txt**: Directives for search engine agents to optimize indexing priority.
- **screenshots/**: A curated library of production-ready captures used in the landing page and the Chrome Web Store promotional material.

## SEO and Discovery Configuration

To maintain top-tier search visibility, the following optimizations are implemented:
- **Semantic HTML5**: Native elements (main, section, article) are used to provide clear document hierarchy.
- **Meta Schema**: Comprehensive Open Graph (OG) and Twitter Card metadata are integrated into the header of every page to optimize social sharing previews.
- **Structured Data**: Canonical links are defined to prevent duplicate content issues across different subdomains.
- **Performance Budget**: No external frameworks or large libraries are permitted, maintaining a sub-100ms Initial Server Response time across global CDNs.

## Deployment and CI/CD Operations

The recommended deployment workflow utilizes a headless content delivery network (CDN) such as Netlify or Vercel:
1. **Source Control**: The `website/` directory is tracked within the main project repository.
2. **Build Hook**: Configuring a "Publish Directory" to `website/` ensures that any commit to the main branch triggers an atomic deployment.
3. **SSL/TLS**: Automated certificate renewal (Let's Encrypt) is required to ensure all traffic is served over HTTPS.

## Visual Identity and Brand Guidelines

The L'Amigo visual identity is anchored in a "Modern Dark" aesthetic:
- **Typography**: Primary headers utilize high-legibility sans-serif faces (Inter/System Stack).
- **Color Palette**: 
  - Background: Deep Obsidian (#0a0a0a)
  - Accent: High-saturation Gradients (Indigo/Azure interface)
  - Text: High-contrast Slate (#f9f9f9)
- **Glassmorphism**: Header and navigation elements utilize `backdrop-filter: blur()` to provide depth and professional visual layering.

---
This infrastructure is maintained by the L'Amigo core development team. For asset contributions or documentation updates, please refer to the main technical README.

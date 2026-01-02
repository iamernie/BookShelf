# Modern BookShelf Documentation

This is the new modern documentation site for BookShelf V2, designed to match the application's design language.

## Features

✨ **Modern Design** - Matches the BookShelf app's color scheme and styling
🌓 **Dark/Light Themes** - Theme toggle with local storage persistence
📱 **Fully Responsive** - Works great on mobile, tablet, and desktop
🎨 **Green Accent Color** - Uses the same emerald green (#10b981) as the app
⚡ **Fast & Lightweight** - Pure HTML/CSS/JS, no build process needed
📋 **Code Copy Buttons** - Easy copying of command examples

## Design System

Matches BookShelf V2's design system:
- **Colors**: Same CSS variables as the app
- **Typography**: Inter font family
- **Components**: Cards, buttons, alerts, code blocks
- **Animations**: Smooth transitions and hover effects

## File Structure

```
docs-site/
├── index.html          # Home page
├── style.css           # Stylesheet (matches app theme)
├── script.js           # Theme toggle and interactions
├── getting-started.html # Installation guide
├── user-guide.html     # User documentation
└── faq.html            # Frequently asked questions
```

## Development

To preview the docs locally:

```bash
# Using Python
cd docs-site
python3 -m http.server 8000

# Using Node.js
npx serve docs-site

# Using PHP
php -S localhost:8000 -t docs-site
```

Then open http://localhost:8000

## Deployment

### GitHub Pages

1. Push the `docs-site` folder to your repository
2. Go to Settings > Pages
3. Select the branch and `/docs-site` folder
4. Your docs will be available at `https://yourusername.github.io/BookShelfV2/`

### Netlify/Vercel

Simply point the deploy to the `docs-site` directory.

## Color Palette

The documentation uses the same colors as BookShelf:

**Light Theme:**
- Background: #f8fafc
- Cards: #ffffff
- Accent: #10b981 (emerald green)
- Text: #1e293b

**Dark Theme:**
- Background: #0f172a
- Cards: #1e293b
- Accent: #34d399
- Text: #f1f5f9

## To-Do

- [ ] Add more page templates (getting-started, user-guide, faq)
- [ ] Add screenshots section
- [ ] Create admin guide page
- [ ] Add search functionality
- [ ] Add breadcrumb navigation

## License

MIT - Same as BookShelf V2

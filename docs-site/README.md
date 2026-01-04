# BookShelf Documentation Site

Modern documentation site for BookShelf, designed to match the application's design language.

## Features

- **Modern Design** - Matches the BookShelf app's color scheme and styling
- **Dark/Light Themes** - Theme toggle with local storage persistence
- **Fully Responsive** - Works great on mobile, tablet, and desktop
- **Green Accent Color** - Uses the same emerald green (#10b981) as the app
- **Fast & Lightweight** - Pure HTML/CSS/JS, no build process needed
- **Code Copy Buttons** - Easy copying of command examples
- **Accordion FAQs** - Expandable Q&A sections

## Pages

- **index.html** - Home page with feature overview
- **getting-started.html** - Installation and setup guide
- **user-guide.html** - Complete user documentation
- **faq.html** - Frequently asked questions

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
4. Your docs will be available at `https://yourusername.github.io/BookShelf/`

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

## Customization

Before deploying, update these placeholders throughout the HTML files:

- `yourusername` - Your GitHub username
- `BookShelf` - Your repository name (if different)
- GitHub repository URLs

## License

MIT - Same as BookShelf

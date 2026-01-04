# 🚀 GitHub Pages Deployment Guide

## Quick Deployment Steps

Follow these steps to deploy your BookShelf documentation to GitHub Pages.

### Step 1: Update Placeholders (Required)

Replace `yourusername` with your actual GitHub username in these files:

```bash
# Quick find all instances
grep -r "yourusername" docs/

# Files to update:
# - docs/_config.yml (url and baseurl)
# - docs/index.md
# - docs/getting-started.md
# - docs/faq.md
# - docs/quick-reference.md
# - docs/user-guide/*.md
# - docs/admin/settings.md
```

**Example changes in `docs/_config.yml`:**
```yaml
# Before:
url: https://yourusername.github.io
baseurl: /BookShelf

# After (if your username is "ernie"):
url: https://ernie.github.io
baseurl: /BookShelf
```

**Note:** Also update repository name if it's not "BookShelf"

### Step 2: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (top right)
3. In left sidebar, click **Pages**
4. Under "Build and deployment":
   - Source: Select **GitHub Actions**
5. Click **Save**

That's it! No other configuration needed.

### Step 3: Sync with Remote First

Since branches have diverged:

```bash
# Pull remote changes first
git pull --rebase origin main

# Or if you prefer merge
git pull origin main
```

### Step 4: Commit and Push

```bash
# Stage all documentation files
git add docs/ .github/workflows/deploy-docs.yml README.md

# Commit with descriptive message
git commit -m "Add comprehensive user documentation for GitHub Pages"

# Push to main branch
git push origin main
```

### Step 5: Monitor Deployment

1. Go to your repository on GitHub
2. Click **Actions** tab (top)
3. You should see "Deploy Documentation to GitHub Pages" workflow running
4. Click on it to see progress
5. Wait for green checkmark (usually 2-3 minutes)

### Step 6: Access Your Documentation

Once deployed, visit:
```
https://yourusername.github.io/BookShelf/
```

Replace with your actual username.

## Troubleshooting

### Branch Diverged?

If you see "Your branch and origin/main have diverged":

```bash
# Pull and merge remote changes
git pull origin main

# Then commit and push your docs
git add docs/ .github/workflows/deploy-docs.yml README.md
git commit -m "Add user documentation for GitHub Pages"
git push origin main
```

### Deployment Failed?

**Check the workflow logs:**
1. Go to Actions tab
2. Click failed workflow
3. Review error messages

**Common issues:**

1. **Ruby/Bundle errors**: Gemfile should install automatically
2. **Permission errors**: Ensure GitHub Actions has write permissions
   - Settings → Actions → General → Workflow permissions
   - Select "Read and write permissions"
   - Save
3. **404 errors**: Check `baseurl` in `_config.yml` matches repo name

### Documentation Not Updating?

**Force a rebuild:**
1. Make a small change to any docs file
2. Commit and push
3. Or manually trigger workflow:
   - Actions tab → Deploy Documentation → Run workflow

## Success Checklist

- [ ] Pulled latest changes from origin/main
- [ ] Updated all "yourusername" placeholders
- [ ] Updated repository name if different
- [ ] Enabled GitHub Pages in settings
- [ ] Committed and pushed documentation
- [ ] Verified workflow succeeded in Actions tab
- [ ] Accessed documentation at GitHub Pages URL
- [ ] Tested navigation and search

## Support

If you encounter issues:
1. Check GitHub Actions logs
2. Review Jekyll build output
3. Open issue with error details

---

**🎉 Ready to Deploy!** Follow the steps above to publish your documentation.

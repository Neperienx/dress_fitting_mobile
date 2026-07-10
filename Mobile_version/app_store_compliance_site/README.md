# Bridal Studio App Store Compliance Site

This folder contains a static public website for the basic Google Play and Apple App Store compliance links:

- `index.html` - pilot landing page
- `support.html` - support URL and onboarding/contact path
- `privacy.html` - public privacy policy
- `terms.html` - public terms and conditions
- `account-deletion.html` - external account deletion request page
- `styles.css` - shared page styles

## Before publishing

Replace every placeholder:

- `[INSERT SUPPORT EMAIL]`
- `[INSERT OPERATOR LEGAL NAME]`
- `[INSERT COUNTRY/REGION]`
- `[INSERT GOVERNING LAW / COUNTRY]`
- `[INSERT COURT OR VENUE]`
- `[INSERT PUBLIC URL]`

The policy and terms are practical drafts based on the current app behavior, but they are not legal advice. Review them before public launch, especially for your operating country, retention policy, support address, and commercial terms.

## Suggested public URLs

Publish this folder through a static host such as GitHub Pages, Netlify, Vercel, Cloudflare Pages, or your own website. Use stable HTTPS URLs similar to:

- `https://your-domain.example/`
- `https://your-domain.example/support`
- `https://your-domain.example/privacy`
- `https://your-domain.example/terms`
- `https://your-domain.example/account-deletion`

Apple App Store Connect usually needs a support URL and a privacy policy URL. Google Play usually needs a privacy policy URL and, for apps with accounts, an account deletion URL.

## Local preview

Open `index.html` directly in a browser. No build step or development server is required.

# Content checklist: what Hyrum still needs to provide

The site launches **full of placeholder content** (the same sample photos, portrait, bio, reviews and FAQ answers the original site had), so it looks complete from the start. Hyrum swaps each one for his own; the admin **Dashboard** keeps a live list of what is left and marks each with a "Placeholder: replace me" badge. Nothing was invented: contact details, addresses, prices and ratings stay blank (and their sections hidden) until he adds them. Add everything below yourself in `/admin` (see `CMS_OWNER_GUIDE.md`); none of it needs a developer.

## Media

- [ ] **12–24 strong haircut photos.** A mix of portrait, square and landscape. Real work only. *Add → Photos.*
- [ ] **Before/after pairs**, clearly labelled which is which, for the Transformations category. *Add → Before & after.*
- [ ] **Hero video**: landscape, 10–20 seconds, MP4, muted-friendly, ideally 1080p and under 20 MB. *Hero.*
  - Right now the site plays the **starter clip** that was already on the old site. The dashboard reminds you until you replace it.
- [ ] **Hero poster image**: a strong still from the video (automatic, or choose your own). *Hero.*
- [ ] **Portrait of Hyrum** with a short description of the photo. *Media → Profile Photo.*
- [ ] **Final social/share image** (1200×630 crop is automatic). *Settings → SEO.*
- [ ] Optional: logo/wordmark preference, and a favicon source (currently plain text brand + a generated placeholder favicon; the file is `web/public/assets/images/favicon.png`, so this one needs the developer).

## Approved wording

- [ ] **Biography.** The starter paragraph is showing (same as the old site). Replace it with your approved bio. *Website Content → About.*
- [ ] Specialties, general location (city/area, and whether a street address may be public), availability note, preferred contact method.
- [ ] Approved **category names** and item titles. Starter categories: Fades, Tapers, Textured, Long Hair, Beards, Transformations. Rename, add or hide as you like.
- [ ] **FAQ answers.** Three general answers are live. **Two say `[Owner to review…]` and need your real wording:** what to bring as a reference photo, and your reschedule/cancellation policy. *Website Content → FAQ.*
- [ ] **Services** you offer, each with a one-line description (starter list: Classic Haircut, Skin Fade, Taper Fade, Textured Crop, Beard Trim & Lineup, Haircut + Beard Combo, Kids Haircut). They show in the home page's Services section and on the request form. Edit, reorder or remove. No prices are shown anywhere. *Settings → Services.*
- [ ] Time windows on the request form (default: Morning / Early afternoon / Late afternoon / Evening). *Settings → Booking Link.*

- [ ] Optional: an **announcement** for time away or holiday hours, with start and end dates so it switches itself on and off. *Website Content → Announcement.*

## Contact, social and booking

- [ ] Business **phone number** and public **email**. *Settings → Contact.* (The Contact section stays hidden until at least one is added.)
- [ ] Email for privacy requests (optional; falls back to the public email). The privacy page currently tells people to use the contact details on the site.
- [ ] Google Maps / directions link, if you want a "Get directions" link.
- [ ] **Instagram** and **Facebook** links. *Settings → Social Links.*
- [ ] **Calendly (or other booking) link.** *Settings → Booking Link.* The old site used a **temporary demo link** (`calendly.com/jamesbaldwindean2026/…`). That link is **not** carried over: enter Hyrum's real one. Until then the Book buttons go to the on-site request form.
- [ ] Turn on **Netlify Forms email notifications** so appointment requests reach you (Netlify → Forms). *(developer/Netlify setting)*

## Reviews

- [ ] Real reviews **with each client's permission**, first name or initial only. *Reviews → Add review → turn on "Approved and shown".* The three `[Placeholder review]` examples are showing until you replace or delete them; never leave them up at launch.

## Domain and SEO

- [ ] Preferred domain confirmed (`hyrumhaircuts.com`) and connected in Netlify. *(developer)*
- [ ] Page title and description you're happy with. *Settings → SEO.*
- [ ] Main website address once the domain is live. *Settings → SEO.*

## Privacy

- [ ] Confirm the wording on the privacy page matches how you actually handle appointment requests.
- [ ] Decide how long you keep requests and who handles deletion requests.

## For the developer (see README)

- [ ] Create the Supabase project, apply migrations, register the owner, disable public sign-ups, configure SMTP.
- [ ] Set the four Netlify environment variables and deploy.
- [ ] Do not launch while the dashboard still lists placeholders (photos, `[Placeholder review]`, `[Owner to review…]`, bio, portrait, starter hero clip).

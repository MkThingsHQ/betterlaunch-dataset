# Product Launch Dataset

[Explore BetterLaunch](https://betterlaunch.app) · [Submit your product](https://betterlaunch.app/dashboard/submit)

**The better product launch platform.**

Discover products from [BetterLaunch](https://betterlaunch.app) for one ISO launch
week at a time. Each sync replaces the previous week's product list.

**0 products · 0 launch weeks · 0 sponsors**

## Sponsors

Products that have supported BetterLaunch, including past sponsors.

No sponsor placements have started yet.

## Products for 2026-W46

No products have launched for this week yet.

## About

Browse the product pages for full descriptions, screenshots, and discussions.
The [JSON dataset](data/dataset.json) includes the public product snapshots and
all sponsor placements that have started, including past campaigns. Products
retain their original launch week and author-provided language. Withdrawn
products, unpublished submissions, future sponsorships, and private account or
payment information are excluded. Sponsors are listed once per website.

## Weekly sync

The workflow runs every Monday at 10:00 Asia/Shanghai (02:00 UTC). GitHub may
start scheduled runs late. By default, the sync requests the current ISO week
using the Asia/Shanghai calendar, including the ISO week year at New Year.
It calls `/api/bot/dataset?year=YYYY&weekNumber=WW` and replaces the product
snapshot instead of accumulating history. A valid empty week clears the old
product list; failed requests or responses containing another week's products
preserve the previous files. Sponsor placements retain their historical scope.

Run manually from GitHub Actions, leaving both inputs empty for the current
week, or supplying both `year` and `weekNumber` for a historical week.
Locally, use `npm run sync -- --year 2026 --week-number 42` with
`BETTERLAUNCH_API_KEY` set. To render an existing weekly snapshot without fetching,
use `npm run render -- --year 2026 --week-number 42`. Both explicit values must
be provided together and form a valid ISO week. After the initial reset, the
catalog stays empty until a successful sync.

The website must support the weekly query parameters before this workflow is
run. The client rejects products from other weeks rather than publishing an
unfiltered response from an older server.

## Contributing

[Submit your product on BetterLaunch](https://betterlaunch.app/dashboard/submit).

## Licenses

Products, descriptions, and logos belong to their respective owners. Inclusion
does not change their licenses or imply endorsement. The automation code and
README template are available under the [MIT License](LICENSE).

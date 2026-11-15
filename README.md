# Product Launch Dataset

[Explore BetterLaunch](https://betterlaunch.app) · [Submit your product](https://betterlaunch.app/dashboard/submit)

**The better product launch platform.**

Discover products from [BetterLaunch](https://betterlaunch.app) for one ISO launch
week at a time. Each sync replaces the previous week's product list.

**16 products · 1 launch weeks · 1 sponsors**

## Sponsors

Products that have supported BetterLaunch, including past sponsors.

| Product | Description |
| --- | --- |
| [AI Free video](https://aifree.video/) | Free AI Video Generator: Turn Text or Photos Into Video |

## Products for 2026-W46

### 2026-W46

| Product | Description | Website |
| --- | --- | --- |
| [AI Free video](https://betterlaunch.app/p/ai-free-video) | Free AI Video Generator: Turn Text or Photos Into Video | [Website](https://aifree.video/) |
| [Skillry](https://betterlaunch.app/p/skillry) | Agent Skills with taste | [Website](https://skillry.dev/) |
| [BizPeel](https://betterlaunch.app/p/bizpeel) | See how real startups grow and make money | [Website](https://bizpeel.com/) |
| [Blob0](https://betterlaunch.app/p/blob0) | Manage S3 storage on your Mac like local files | [Website](https://blob0.com/) |
| [MkExt](https://betterlaunch.app/p/mkext) | Open-source browser extension starter for SaaS applications. | [Website](https://mkext.dev/) |
| [MkAgent](https://betterlaunch.app/p/mkagent) | A local-first, Pi-powered AI agent workspace for Desktop, WebUI, and CLI. | [Website](https://mkagent.app/) |
| [海棠诗社](https://betterlaunch.app/p/%E6%B5%B7%E6%A3%A0%E8%AF%97%E7%A4%BE) | 古诗词的数字桃源 | [Website](https://haitang.app/) |
| [IndieHub](https://betterlaunch.app/p/indiehub) | The Best All-in-One Directory for Indie Makers | [Website](https://indiehub.best/) |
| [Mkdirs](https://betterlaunch.app/p/mkdirs) | The Best Directory Boilerplate with AI | [Website](https://mkdirs.com/) |
| [MkImage](https://betterlaunch.app/p/mkimage) | AI Image Prompt Gallery | [Website](https://mkimage.ai/) |
| [MkSaaS](https://betterlaunch.app/p/mksaas) | Make Your AI SaaS Product in a Weekend | [Website](https://mksaas.com/) |
| [TanStarter](https://betterlaunch.app/p/tanstarter) | Ship Faster with TanStack, Cost Less with Cloudflare | [Website](https://tanstarter.dev/) |
| [My 12 Axes](https://betterlaunch.app/p/my-12-axes) | Free 12 axes political test, no sign-up | [Website](https://my12axes.com/) |
| [12 Axes Test](https://betterlaunch.app/p/12-axes-test) | Where do you stand? | [Website](https://12axestest.com/) |
| [FreeBillKit](https://betterlaunch.app/p/freebillkit) | Free business document generator. No signup. | [Website](https://freebillkit.com/) |
| [Nevect](https://betterlaunch.app/p/nevect) | Self-hosted affiliate tracking with S2S postbacks | [Website](https://nevect.com/) |

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

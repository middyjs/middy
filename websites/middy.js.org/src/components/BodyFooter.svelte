<script>
import BodyFooter from "@design-system/components/BodyFooter.svelte";
import Image from "@design-system/components/Image.svelte";
import A from "@design-system/elements/a.svelte";
import { page } from "$app/state";

const { children } = $props();
const { url, params, data, form } = page;

const navLinks = {
	Docs: {
		Documentation: "/docs",
		Middlewares: "/docs/middlewares/intro",
		"AWS Events": "/docs/events/intro",
		LLMs: "/llms.txt",
	},
	"Community & support": {
		GitHub: "https://github.com/middyjs/middy",
		StackOverflow:
			"https://stackoverflow.com/questions/tagged/middy?sort=Newest&uqlId=35052",
	},
	More: {
		npm: "https://www.npmjs.com/package/@middy/core",
		"OpenSSF Scorecard":
			"https://scorecard.dev/viewer/?uri=github.com/middyjs/middy",
		"OpenSSF Best Practice":
			"https://www.bestpractices.dev/en/projects/5280/gold",
		Sponsor: "https://github.com/sponsors/willfarrell",
	},
};
</script>

<BodyFooter navLinks={navLinks}>
    {#snippet logo()}
        <A href="/">
          <Image
            src="/img/middy-logo.svg"
            alt="Middy logo, to the homepage"
            width="160"
			height="180"
          />
        </A>
    {/snippet}
</BodyFooter>

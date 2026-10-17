<script>
import BodyFooter from "@willfarrell-ds/svelte/components/BodyFooter.svelte";
import Image from "@willfarrell-ds/svelte/components/Image.svelte";
import A from "@willfarrell-ds/svelte/elements/a.svelte";

const navLinks = {
	Docs: {
		Documentation: "/docs",
		Middlewares: "/docs/middlewares/intro",
		"AWS Events": "/docs/events/intro",
		"LLMs (Large Language Models)": "/llms.txt",
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

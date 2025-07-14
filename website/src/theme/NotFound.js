import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";

function NotFound() {
	return (
		<Layout title="Page Not Found">
			<main className="container margin-vert--xl">
				<div className="row">
					<div className="col col--6 col--offset-3">
						<h1 className="hero__title">404</h1>
						<p>
							<img src="/img/middy-404.gif" alt="404" />
						</p>
						<p className="hero__subtitle">
							Sorry, we could not find what you were looking for!
						</p>
						<p>
							Please contact the owner of the site that linked you to the
							original URL and let them know their link is broken.
						</p>

						<p
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "start",
								gap: "1em",
							}}
						>
							<Link className="button button--primary button--lg" to="/">
								Go to the home
							</Link>
							<Link className="button button--secondary button--lg" to="/docs">
								Read the docs
							</Link>
						</p>
					</div>
				</div>
			</main>
		</Layout>
	);
}

export default NotFound;

import clsx from "clsx";
import styles from "./HomepageFeatures.module.css";

/*
AWS Powertools team
 */

const UseList = [
	{
		id: "awslabs",
		title: "Amazon Web Services - Labs",
		url: "https://github.com/awslabs/aws-lambda-powertools-typescript", // https://github.com/awslabs/aws-lambda-powertools-typescript
		img: "/img/logo/awslabs.png",
	},

	/*
  {
    title: 'Organization Name',
    url: 'https://github.com/{github username}', // https://github.com/{username}/{repo}
    img: '/img/logo/{from github}.png'
  },
  */
];

function Feature({ title, url, img }) {
	return (
		<div className={clsx("col")}>
			<a href={url} className="padding-horiz--md">
				<img className={styles.featureSvg} alt={title} src={img} />
			</a>
		</div>
	);
}

export default function HomepageWhatUsersSay() {
	return (
		<section className={styles.features}>
			<div className="container">
				<h2>What users say</h2>
				<div className="row">
					{UseList.map((props) => (
						<Feature key={props.id} {...props} />
					))}
				</div>
			</div>
		</section>
	);
}

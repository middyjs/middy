import clsx from "clsx";
import React from "react";
import styles from "./HomepageSponsors.module.css";

const emptySponsor = {
	title: "Sponsor",
	url: "https://github.com/sponsors/willfarrell",
	img: "/img/logo/reserved.svg",
};

const SponsorListLevel2 = [
	{
		id: "fourtheorem",
		url: "https://fourtheorem.com",
		img: "/img/logo/fourtheorem.svg",
		// 2023-07 - 2025-06
	},
	{
		id: "aws",
		url: "https://github.com/aws",
		img: "/img/logo/amazon-web-services.svg",
		// 2023-11-08
	},
	emptySponsor,
];

// const SponsorListLevel3 = []
const SponsorListLevel4 = [
	/* {
    id: '',
    title: 'Distinction Dev',
    url: 'https://distinction.dev',
    img: '/img/logo-square/distinction-dev.png'
  }, */
];

function Feature({ title, url, Component, img }) {
	return (
		<div className={clsx("col")}>
			<a href={url} className="padding-horiz--md">
				<img className={styles.featureSvg} alt={title} src={img} />
			</a>
		</div>
	);
}

export default function HomepageSponsors() {
	return (
		<section className={styles.features}>
			<div className="container">
				<h2>Sponsors</h2>
				<div className="row">
					{SponsorListLevel2.map((props) => (
						<Feature key={props.id} {...props} size="33" />
					))}
				</div>
				<div className="row">
					{SponsorListLevel4.map((props) => (
						<Feature key={props.id} {...props} size="10" />
					))}
				</div>
			</div>
		</section>
	);
}

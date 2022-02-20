import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import styles from './GetStartedHero.module.css';

export default function GetStartedHero () {
  return (<header className={clsx('hero hero--secondary', styles.heroBanner)}>
    <div className="container text--center margin-vert--xl">
      <h1 className="hero__title">Ready to get started?</h1>
      {/* <p className="hero__subtitle">{siteConfig.tagline}</p> */}
      <div className={styles.buttons}>
        <Link
          className="button button--primary button--lg"
          to="/docs">
          Read the docs
        </Link>
      </div>
    </div>
  </header>)
}

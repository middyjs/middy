import styles from './HomepageSponsors.module.css'
import React from 'react'
import clsx from 'clsx'
import FourTheoremLogo from './sponsors/fourtheorem'
import AwsLogo from './sponsors/aws'

const emptySponsor = {
  title: 'Sponsor',
  url: 'https://github.com/sponsors/willfarrell',
  img: '/img/logo/reserved.svg'
}

const SponsorListLevel2 = [
  {
    url: 'https://fourtheorem.com',
    Component: (
      <FourTheoremLogo className={styles.featureSvg} title='fourThereom' />
    )
    // 2023-07 - 2024-06
  },
  {
    url: 'https://github.com/aws',
    Component: (
      <AwsLogo
        className={styles.featureSvg}
        title='Amazon Web Services Free and Open Source Software Fund (AWS FOSS Fund)'
      />
    )
    // 2023-11-08
  },
  emptySponsor
]

// const SponsorListLevel3 = []
const SponsorListLevel4 = [
  /* {
    title: 'Distinction Dev',
    url: 'https://distinction.dev',
    img: '/img/logo-square/distinction-dev.png'
  }, */
]

function Feature ({ title, url, Component, size }) {
  return (
    <div className={clsx('col')}>
      <a href={url} className='padding-horiz--md'>
        {Component}
      </a>
    </div>
  )
}

export default function HomepageSponsors () {
  return (
    <section className={styles.features}>
      <div className='container'>
        <h2>Sponsors</h2>
        <div className='row'>
          {SponsorListLevel2.map((props, idx) => (
            <Feature key={idx} {...props} size='33' />
          ))}
        </div>
        <div className='row'>
          {SponsorListLevel4.map((props, idx) => (
            <Feature key={idx} {...props} size='10' />
          ))}
        </div>
      </div>
    </section>
  )
}

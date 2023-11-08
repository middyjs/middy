import styles from './HomepageSponsors.module.css'
import React from 'react'
import clsx from 'clsx'

/*
AWS Powertools team
 */

/*
 {
   title: 'Organization Name',
   url: 'https://github.com/{github username}', // https://github.com/{username}/{repo}
   img: '/img/logo/{from github}.png'
 },
 */

const emptySponsor = {
  title: 'Sponsor',
  url: 'https://github.com/sponsors/willfarrell',
  img: '/img/logo/reserved.svg'
}

// const SponsorListLevel1 = []
const SponsorListLevel2 = [
  {
    title: 'fourThereom',
    url: 'https://fourtheorem.com',
    img: '/img/logo/fourthereom.svg'
    // 2023-07 - 2024-06
  },
  {
    title:
      'Amazon Web Services Free and Open Source Software Fund (AWS FOSS Fund)',
    url: 'https://github.com/aws',
    img: '/img/logo/amazon-web-services.svg'
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

function Feature ({ title, url, img, size }) {
  return (
    <div className={clsx('col')}>
      <a href={url} className='padding-horiz--md'>
        <img className={styles.featureSvg} alt={title} src={img} />
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

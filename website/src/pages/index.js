import React from 'react'
import clsx from 'clsx'
import Layout from '@theme/Layout'
import Link from '@docusaurus/Link'
import styles from './index.module.css'
import HomepageFeatures from '../components/HomepageFeatures'
// import HomepageWhatUsersSay from '../components/HomepageWhatUsersSay'
// import HomepageWhoUses from '../components/HomepageWhoUses'
import Example from '../components/Example'
import GetStartedHero from '../components/GetStartedHero'
import Logo from '../components/logo'
import Head from '@docusaurus/Head'

function HomepageHeader () {
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className='container'>
        <Logo className={styles.logo} width='350' />
        <p className='hero__subtitle'>
          The stylish Node.js middleware engine for AWS Lambda
        </p>
        <p>
          Organise your Lambda code, remove code duplication, focus on business
          logic!
        </p>
        <div className={styles.buttons}>
          <Link className='button button--secondary button--lg' to='/docs'>
            Get started
          </Link>
        </div>
      </div>
    </header>
  )
}

const Seo = () => {
  const title = 'Middy, the stylish Node.js middleware engine for AWS Lambda'
  const description =
    'Middy is a Node.js middleware engine for AWS Lambda that lets you organise your Lambda code, remove code duplication, and focus on business logic!'

  return (
    <Head>
      <meta charSet='utf-8' />
      <title>{title}</title>
      <meta name='description' content={description} />
      <link rel='canonical' href='https://middy.js.org' />
      <meta property='og:title' content={title} />
      <meta property='og:description' content={description} />
      <meta
        property='og:image'
        content='https://middy.js.org/img/middy-og-image.png'
      />
      <meta property='og:image:width' content='1200' />
      <meta property='og:image:height' content='630' />
    </Head>
  )
}

export default function Home () {
  return (
    <Layout>
      <Seo />
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <Example />
        <GetStartedHero />
      </main>
    </Layout>
  )
}

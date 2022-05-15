import styles from './HomepageFeatures.module.css'
import React from 'react'
import clsx from 'clsx'

/*
https://github.com/middyjs/middy/network/dependents?package_id=UGFja2FnZS00Njc1NDUzOTU%3D

https://github.com/DefinitelyTyped/DefinitelyTyped
https://github.com/swarmion (73)
https://github.com/mtimbs/typescript-serverless
https://github.com/serverlesspolska/serverless-hexagonal-template
https://github.com/theburningmonk/appsyncmasterclass-backend
https://github.com/getndazn/dazn-lambda-powertools (edited)
 */

const UseList = [
  {
    title: 'Amazon Web Services - Labs',
    url: 'https://github.com/awslabs/aws-lambda-powertools-typescript', // https://github.com/awslabs/aws-lambda-powertools-typescript
    img: '/img/logo/awslabs.png'
  },
  {
    title: 'Serverless',
    url: 'https://github.com/serverless', // https://github.com/serverless/examples
    img: '/img/logo/serverless.png'
  },
  /* {
    title: 'RedwoodJS',
    url: 'https://github.com/redwoodjs', // https://github.com/redwoodjs/redwood | https://github.com/redwoodjs/redwood/issues/398
    img: '/img/logo/redwoodjs.png'
  }, */
  {
    title: 'Serverless Stack',
    url: 'https://github.com/serverless-stack/serverless-stack', // https://github.com/serverless-stack/serverless-stack
    img: '/img/logo/serverless-stack.png'
  },
  {
    title: 'NX Serverless',
    url: 'https://github.com/ngneat/nx-serverless', // https://github.com/ngneat/nx-serverless
    img: '/img/logo/nx-serverless.png'
  },
  {
    title: 'Auth0',
    url: 'https://github.com/auth0', // https://github.com/auth0/YearInCode
    img: '/img/logo/auth0.png'
  },
  {
    title: 'SuperTokens',
    url: 'https://github.com/supertokens', // https://github.com/supertokens
    img: '/img/logo/supertokens.png'
  },
  {
    title: 'Uniswap Labs',
    url: 'https://github.com/Uniswap', // https://github.com/Uniswap/routing-api
    img: '/img/logo/uniswap.png'
  },
  {
    title: 'DataStream',
    url: 'https://datasteam.org', // https://github.com/datastreamapp
    img: '/img/logo/datastream.png'
  },
  {
    title: 'Aporia AI',
    url: 'https://github.com/aporia-ai', // https://github.com/aporia-ai/mlnotify
    img: '/img/logo/aporia-ai.png'
  },
  {
    title: 'DAZN',
    url: 'https://github.com/getndazn', // https://github.com/getndazn/dazn-lambda-powertools
    img: '/img/logo/dazn.png'
  }
  /*
  {
    title: 'Organization Name',
    url: 'https://github.com/{github username}', // https://github.com/{username}/{repo}
    img: '/img/logo/{from github}.png'
  },
  */
]

function Feature ({ title, url, img }) {
  return (
    <div className={clsx('col')}>
      <a href={url} className='padding-horiz--md'>
        <img className={styles.featureSvg} alt={title} src={img} />
      </a>
    </div>
  )
}

export default function HomepageWhoUses () {
  return (
    <section className={styles.features}>
      <div className='container'>
        <h2>Who uses Middy</h2>
        <div className='row'>
          {UseList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  )
}

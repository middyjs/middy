import React from 'react'
import clsx from 'clsx'
import Link from '@docusaurus/Link'
import styles from './HomepageFeatures.module.css'

const FeatureList = [
  {
    title: 'Simple but powerful',
    Svg: require('../../static/img/powerful.svg').default,
    description: (
      <>
        A middleware engine makes your code more organised, removes duplication
        and uniforms the handling of non-functional concerns like
        authentication, authorization, validation, and serialization.
      </>
    )
  },
  {
    title: 'Focus on what matters',
    Svg: require('../../static/img/focus.svg').default,
    description: (
      <>
        By pushing all the non-functional code to middlewares, you can be
        productive and focus on what matters the most: the business logic!
      </>
    )
  },
  {
    title: 'Small core',
    Svg: require('../../static/img/small-core.svg').default,
    description: (
      <>
        Middy comes with a very small core and an unobtrusive API to add the
        minimum amount of overhead to your code.
      </>
    )
  },
  {
    title: 'Batteries included',
    Svg: require('../../static/img/batteries-included.svg').default,
    description: (
      <>
        Middy comes with a large set of{' '}
        <Link to='/docs/middlewares/intro'>official middlewares</Link> and{' '}
        <Link to='/docs/intro/utilities'>utilities</Link> that can be used out
        of the box to address the most common non-functional use cases.
      </>
    )
  },
  {
    title: 'Blazing fast',
    Svg: require('../../static/img/blazing-fast.svg').default,
    description: (
      <>
        Middy has been engineered to keep your lambda as fast as possible. The
        minimal core keeps your lambda size small and your cold starts under
        control. Add only what you need!
      </>
    )
  },
  {
    title: 'Extensible',
    Svg: require('../../static/img/extensible.svg').default,
    description: (
      <>
        Do you need to do more? It's really easy to{' '}
        <Link to='/docs/writing-middlewares/intro'>
          write your own custom middlewares
        </Link>
        . And, if that's not enough, you can even extend middy itself through
        its <Link to='/docs/intro/hooks'>hooks</Link>.
      </>
    )
  }
]

function Feature ({ Svg, title, description }) {
  return (
    <div className={clsx('col col--4')}>
      <div className='padding-horiz--md'>
        <Svg className={styles.featureSvg} alt={title} />
      </div>
      <div className=' padding-horiz--md'>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  )
}

export default function HomepageFeatures () {
  return (
    <section className={styles.features}>
      <div className='container'>
        <div className='row'>
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  )
}

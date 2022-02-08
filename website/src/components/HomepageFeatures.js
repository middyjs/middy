import React from 'react';
import clsx from 'clsx';
import styles from './HomepageFeatures.module.css';

const FeatureList = [
  {
    title: 'Simple but powerful',
    Svg: require('../../static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        A middleware engine makes your code more organised, removes duplication and uniforms
        the hanlding of non-functional concerns like authentication,
        authorization, validation, and serialization.
      </>
    ),
  },
  {
    title: 'Focus on what matters',
    Svg: require('../../static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        By pushing all the non-functional code to middlewares, you can be productive
        and focus on what matters the most: the business logic!
      </>
    ),
  },
  {
    title: 'Small core',
    Svg: require('../../static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Middy comes with a very small core and an unobtrusive API to add the minimum
        amount of overhead to your code.
      </>
    ),
  },
  {
    title: 'Batteries included',
    Svg: require('../../static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Middy comes with a large set of official middlewares and utilities that can be used
        out of the box to address the most common non-functional use cases.
      </>
    ),
  },
  {
    title: 'Blazing fast',
    Svg: require('../../static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Middy has been engineered to keep your lambda as fast as possible.
        The minimal core keeps your lambda size small and your cold starts under control.
        Add only what you need!
      </>
    ),
  },
  {
    title: 'Extensible',
    Svg: require('../../static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Do you need to do more? It's really easy to write your own custom middlewares.
        And, if that's not enough, you can even extend middy itself through its plugin system.
      </>
    ),
  },
];

function Feature ({ Svg, title, description }) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} alt={title} />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures () {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}

import React from 'react';
import clsx from 'clsx';
import styles from './Example.module.css';
import CodeBlock from '@theme/CodeBlock'

const codeWithoutMiddy = `export function handler (event) {
  // decrypt environment variables with KMS
  // deserialize the content of the event
  // validate input, authentication, authorization
  
  // REAL BUSINESS LOGIC
  response = doSomethingUsefulWith(event)
  
  // validate output
  // serialize response
  // handle errors
}
`

const codeWithtMiddy = `// highlight-start
import middy from '@middy/core'
import {
  kms,
  serialization,
  validation,
  auth,
  handleErrors
} from './my-middlewares.js'
// highlight-end

function handler (event) {
  // REAL BUSINESS LOGIC
  return doSomethingUsefulWith(event)
}

// highlight-start
const middifiedHandler = middy(handler)
  .use(kms())
  .use(serialization())
  .use(validation())
  .use(auth())
  .use(handlerErrors())
// highlight-end

export default middifiedHandler
`

export default function Example () {
  return (
    <section className={styles.example}>
      <div className="container">
        <h2 className={styles.heading}>
          Show me the code!
        </h2>
        <p className='text--center'>The following example illustrates the difference of style when using Middy</p>

        <div className="row padding-vert--lg">

          <div className={clsx('col col--6')}>
            <div className="padding-horiz--md">
              <h3>Without Middy</h3>
            </div>
            <div className="padding-horiz--md">
              <CodeBlock language="js" title="handler.js">
                {codeWithoutMiddy}
              </CodeBlock>
              <p>
                Without Middy all your non-functional code is mixed up with the actual business logic in your handler.
              </p>
              <p>The code is hard to understand and maintain. What if you need to reuse some of the non-funcitonal logic in another handler?</p>
            </div>
          </div>

          <div className={clsx('col col--6')}>
            <div className="padding-horiz--md">
              <h3>With Middy</h3>
            </div>
            <div className="padding-horiz--md">
              <CodeBlock language="js" title="handler.js">
                {codeWithtMiddy}
              </CodeBlock>
              <p>
                Middy helps you to keep all the non-functional code outside from your handler function.
              </p>
              <p>
                The business logic in your handler remains pure and testable. All the non functional logic is isolated and reusable.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

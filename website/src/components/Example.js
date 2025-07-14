import Link from "@docusaurus/Link";
import CodeBlock from "@theme/CodeBlock";
import clsx from "clsx";
import styles from "./Example.module.css";

const codeWithoutMiddy = `export const handler = (event, context) => {
  // BOILERPLATE!
  // E.g. decrypt environment variables with KMS
  // deserialize the content of the event
  // validate input, authentication, authorization

  // REAL BUSINESS LOGIC
  let response = doSomethingUsefulWith(event)

  // MORE BOILERPLATE
  // E.g.
  // validate output
  // serialize response
  // handle errors
  return response
}
`;

const codeWithtMiddy = `// highlight-start
import middy from '@middy/core'
// highlight-end

const lambdaHandler = (event, context) => {
  // REAL BUSINESS LOGIC
  return doSomethingUsefulWith(event)
}

// highlight-start
export const handler = middy(lambdaHandler)
  .use(/* Your own behaviour in a reusable fashion */)
  .use(/* logging and tracing */)
  .use(/* input validation */)
  .use(/* authentication */)
  .use(/* error handling */)
  .use(/* other behaviour */)
// highlight-end
`;

export default function Example() {
	return (
		<section className={styles.example}>
			<div className="container">
				<h2 className={styles.heading2}>Show me the code!</h2>
				<p className="text--center">
					The following abstract example illustrates the difference of style
					when using Middy:
				</p>

				<div className="row padding-vert--lg">
					<div className={clsx("col col--6")}>
						<div className="padding-horiz--md">
							<h3>Without Middy</h3>
						</div>
						<div className="padding-horiz--md">
							<CodeBlock language="js" title="handler.js">
								{codeWithoutMiddy}
							</CodeBlock>
							<p>
								Without Middy all your non-functional code is mixed up with the
								actual business logic in your handler.
							</p>
							<p>
								The code is hard to understand and maintain. What if you need to
								reuse some of the non-functional logic in another handler?
							</p>
						</div>
					</div>

					<div className={clsx("col col--6")}>
						<div className="padding-horiz--md">
							<h3>With Middy</h3>
						</div>
						<div className="padding-horiz--md">
							<CodeBlock language="js" title="handler.js">
								{codeWithtMiddy}
							</CodeBlock>
							<p>
								Middy helps you to keep all the non-functional code outside from
								your handler function.
							</p>
							<p>
								The business logic in your handler remains pure and testable.
								All the non functional logic is isolated and reusable.
							</p>
						</div>
					</div>
				</div>

				<h3 className={styles.heading3}>
					Do you want to see some more <em>realistic</em> examples?
				</h3>

				<p className={styles.buttons_list}>
					<Link
						to="/docs/events/api-gateway-http"
						className="button button--info"
					>
						API Gateway (HTTP)
					</Link>{" "}
					<Link
						to="/docs/events/api-gateway-rest"
						className="button button--info"
					>
						API Gateway (REST)
					</Link>{" "}
					<Link
						to="/docs/events/api-gateway-ws"
						className="button button--info"
					>
						API Gateway (WebSockets)
					</Link>{" "}
					<Link to="/docs/events/function-url" className="button button--info">
						Function URL
					</Link>{" "}
					<Link to="/docs/events/s3-object" className="button button--info">
						S3 Object Response
					</Link>{" "}
					<Link to="/docs/events/sqs" className="button button--info">
						SQS
					</Link>{" "}
				</p>
			</div>
		</section>
	);
}

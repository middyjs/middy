<script>
import Card from "@design-system/svelte/Card.svelte";
import Codeblock from "@design-system/svelte/Codeblock.svelte";
import A from "@design-system/svelte/element/a.svelte";
import Div from "@design-system/svelte/element/div.svelte";
import Em from "@design-system/svelte/element/em.svelte";
import Li from "@design-system/svelte/element/li.svelte";
import P from "@design-system/svelte/element/p.svelte";
import Section from "@design-system/svelte/element/section.svelte";
import Span from "@design-system/svelte/element/span.svelte";
import Ul from "@design-system/svelte/element/ul.svelte";
import H1 from "@design-system/svelte/Heading1.svelte";
import H2 from "@design-system/svelte/Heading2.svelte";
import H3 from "@design-system/svelte/Heading3.svelte";
import Icon from "@design-system/svelte/Icon.svelte";
import Image from "@design-system/svelte/Image.svelte";
import LayoutSlices from "@design-system/svelte/LayoutSlices.svelte";
import { page } from "$app/state";

const { data } = page;

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
}`;
const codeWithMiddy = `import middy from '@middy/core'

const lambdaHandler = (event, context) => {
  // REAL BUSINESS LOGIC
  return doSomethingUsefulWith(event)
}

export const handler = middy(lambdaHandler)
  .use(/* Your own behaviour in a reusable fashion */)
  .use(/* logging and tracing */)
  .use(/* input validation */)
  .use(/* authentication */)
  .use(/* error handling */)
  .use(/* other behaviour */)`;
</script>

<svelte:head>
    <title>Middy.js</title>
    <meta
        name="description"
        content="The stylish Node.js middleware engine for AWS Lambda"
    />
</svelte:head>
<LayoutSlices>
    <Section class="slice hero vertical">
        <Div class="inline-center">
            <Image
                alt="Middy logo"
                src="/img/middy-logo.svg"
                width="640"
                height="359"
                decoding="auto"
                fetchpriority="high"
                loading="eager"
            />
            <H1>The stylish Node.js middleware engine for AWS Lambda</H1>

            <P
                >Organise your Lambda code, remove code duplication, focus on
                business logic. Simple, fast, and extensible.</P
            >
            <Div role="group">
                <P>
                    <A href="/docs" class="button"
                        ><Span>Get started</Span>
                        <Icon src="/img/icons.svg#arrow-inline-end" /></A
                    ></P
                ></Div
            >
            <H2 class="visually-hidden">Strong community</H2>
            <Ul class="grid">
                <Li class="stat">
                    <H3
                        ><Icon src="/img/icons.svg#star" />
                        <Span>3.9k</Span></H3
                    >
                    <P>GitHub Stars</P>
                </Li>
                <Li class="stat">
                    <H3
                        ><Icon src="/img/icons.svg#download" />
                        <Span>2M+</Span></H3
                    >
                    <P>Monthly downloads</P>
                </Li>
                <Li class="stat">
                    <H3
                        ><Icon src="/img/icons.svg#users" />
                        <Span>200+</Span></H3
                    >
                    <P>Contributors</P>
                </Li>
            </Ul>
        </Div>
    </Section>
    <Section class="slice grid">
        <Div class="inline-center">
            <H2>Everything you need for clean Lambda code</H2>
        </Div>
        <Ul class="grid">
            <Li class="feature">
                <Image
                    src="/img/home/powerful.svg"
                    alt=""
                    height="100"
                    width="100"
                />
                <H3>Simple but powerful</H3>
                <P
                    >A middleware engine makes your code more organised, removes
                    duplication and uniforms the handling of non-functional
                    concerns like authentication, authorization, validation, and
                    serialization.</P
                >
            </Li>
            <Li class="feature">
                <Image
                    src="/img/home/focus.svg"
                    alt=""
                    height="100"
                    width="100"
                />
                <H3>Focus on what matters</H3>
                <P
                    >By pushing all the non-functional code to middlewares, you
                    can be productive and focus on what matters the most: the
                    business logic!</P
                >
            </Li>
            <Li class="feature">
                <Image
                    src="/img/home/small-core.svg"
                    alt=""
                    height="100"
                    width="100"
                />
                <H3>Small core</H3>
                <P
                    >Middy comes with a very small core and an unobtrusive API
                    to add the minimum amount of overhead to your code.</P
                >
            </Li>
            <Li class="feature">
                <Image
                    src="/img/home/batteries-included.svg"
                    alt=""
                    height="100"
                    width="100"
                />
                <H3>Batteries included</H3>
                <P
                    >Middy comes with a large set of <A
                        href="/docs/middlewares/intro">official middlewares</A
                    > and <A href="/docs/intro/utilities">utilities</A> that can be
                    used out of the box to address the most common non-functional
                    use cases.</P
                >
            </Li>
            <Li class="feature">
                <Image
                    src="/img/home/blazing-fast.svg"
                    alt=""
                    height="100"
                    width="100"
                />
                <H3>Blazing fast</H3>
                <P
                    >Middy has been engineered to keep your lambda as fast as
                    possible. The minimal core keeps your lambda size small and
                    your cold starts under control. Add only what you need!</P
                >
            </Li>
            <Li class="feature">
                <Image
                    src="/img/home/extensible.svg"
                    alt=""
                    height="100"
                    width="100"
                />
                <H3>Extensible</H3>
                <P
                    >Do you need to do more? It's really easy to <A
                        href="/docs/writing-middlewares/intro"
                        >write your own custom middlewares</A
                    >. And, if that's not enough, you can even extend middy
                    itself through its <A href="/docs/intro/hooks">hooks</A>.</P
                >
            </Li>
        </Ul>
    </Section>
    <Section class="slice vertical">
        <Div class="inline-center">
            <H2>Show me the code!</H2>
            <P
                >The following abstract example illustrates the difference of
                style when using Middy:</P
            >
        </Div>
        <Div class="horizontal">
            <Div class="inline-start">
                <H3>Without Middy</H3>
                <Codeblock code={codeWithoutMiddy}>{codeWithoutMiddy}</Codeblock
                >
                <P
                    >Without Middy all your non-functional code is mixed up with
                    the actual business logic in your handler.</P
                >
                <P
                    >The code is hard to understand and maintain. What if you
                    need to reuse some of the non-functional logic in another
                    handler?</P
                >
            </Div>
            <Div class="inline-end">
                <H3>With Middy</H3>
                <Codeblock code={codeWithMiddy}>{codeWithMiddy}</Codeblock>
                <P
                    >Middy helps you to keep all the non-functional code outside
                    from your handler function.</P
                >
                <P
                    >The business logic in your handler remains pure and
                    testable. All the non functional logic is isolated and
                    reusable.</P
                >
            </Div></Div
        >
    </Section>
    <Section class="slice vertical">
        <Div class="inline-center">
            <H2>Do you want to see some more <Em>realistic</Em> examples?</H2>
            <P>See how Middy works across different AWS Lambda trigger types.</P
            >
            <!-- <Div role="group">
                <A class="button" href="/docs/events/api-gateway-http"
                    >API Gateway (HTTP)</A
                >
                <A class="button" href="/docs/events/api-gateway-rest"
                    >API Gateway (REST)</A
                >
                <A class="button" href="/docs/events/api-gateway-ws"
                    >API Gateway (WebSockets)</A
                >
                <A class="button" href="/docs/events/function-url"
                    >Function URL</A
                >
                <A class="button" href="/docs/events/s3-object"
                    >S3 Object Response</A
                >
                <A class="button" href="/docs/events/sqs">SQS</A>
            </Div> -->
        </Div>
        <Ul class="grid">
            <Card
                href="/docs/events/api-gateway-http"
                class="event"
                id="api-gateway-http"
            >
                <H3
                    ><A href="/docs/events/api-gateway-http"
                        >API Gateway (HTTP)</A
                    ></H3
                >
                <P>Build APIs with API Gateway v2.</P>
            </Card>
            <Card
                href="/docs/events/api-gateway-rest"
                class="event"
                id="api-gateway-rest"
            >
                <H3
                    ><A href="/docs/events/api-gateway-rest"
                        >API Gateway (REST)</A
                    ></H3
                >
                <P>Classic REST API integration with API Gateway v1.</P>
            </Card>
            <Card
                href="/docs/events/api-gateway-ws"
                class="event"
                id="api-gateway-ws"
            >
                <H3
                    ><A href="/docs/events/api-gateway-ws"
                        >API Gateway (WebSockets)</A
                    ></H3
                >
                <P>Real-time bi-directional communication via WebSockets.</P>
            </Card>
            <Card
                href="/docs/events/function-url"
                class="event"
                id="function-url"
            >
                <H3><A href="/docs/events/function-url">Function URL</A></H3>
                <P>Build APIs with API Gateway v2.</P>
            </Card>
            <Card href="/docs/events/sqs" class="event" id="sqs">
                <H3><A href="/docs/events/sqs">SQS</A></H3>
                <P>Process messages from SQS queues reliably.</P>
            </Card>
            <Card class="event" id="s3-object">
                <H3><A href="/docs/events/s3-object">S3 Object Response</A></H3>
                <P>Transform S3 Object responses with Lambda.</P>
            </Card>
            <Card class="event" id="dynamodb">
                <H3><A href="/docs/events/dynamodb">DynamoDB</A></H3>
                <P>Action DynamoDB events.</P>
            </Card>
            <Card class="event" id="sns">
                <H3><A href="/docs/events/sns">SNS</A></H3>
                <P>Process notifications from SNS with ease.</P>
            </Card>
        </Ul>
    </Section>
    <Section class="slice vertical">
        <Div class="inline-center">
            <H2>Ready to get started?</H2><P>
                Install Middy in seconds and start building cleaner Lambda
                functions today.
            </P>
            <A href="/docs" class="button"
                ><Span>Read the docs</Span>
                <Icon src="/img/icons.svg#arrow-inline-end" />
            </A>
        </Div>
    </Section>
    <Section class="slice vertical">
        <Div class="inline-center">
            <H2>Supported by the community</H2>
            <P>Middy is open-source and supported by amazing sponsors.</P>
        </Div>
        <Ul class="grid">
            <Li class="sponsor">
                <!-- 2023-07 - 2026-06 -->
                <A href="https://fourtheorem.com">
                    <Image
                        src="/img/sponsor/fourtheorem.svg"
                        alt="FourTheorem"
                        height="96"
                        width="773"
                    /></A
                >
            </Li>
            <Li class="sponsor">
                <!-- 2023-11-08 -->
                <A href="https://github.com/aws">
                    <Image
                        src="/img/sponsor/amazon-web-services.svg"
                        alt="Amazon Web Services"
                        height="182"
                        width="304"
                    /></A
                >
            </Li>
        </Ul>
        <Div class="inline-center">
            <P>
                <A href="https://github.com/sponsors/willfarrell" class="button"
                    ><Icon src="/img/icons.svg#heart" /><Span
                        >Become a sponsor</Span
                    >
                </A></P
            >
        </Div>
    </Section>
</LayoutSlices>

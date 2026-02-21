---
title: How it works
position: 3
---

Middy implements the classic _onion-like_ middleware pattern, with some peculiar details.

![Middy middleware engine diagram](/img/middy-middleware-engine.png)

When you attach a new middleware this will wrap the business logic contained in the handler
in two separate steps.

When another middleware is attached this will wrap the handler again and it will be wrapped by
all the previously added middlewares in order, creating multiple layers for interacting with
the _request_ (event) and the _response_.

This way the _request-response cycle_ flows through all the middlewares, the
handler and all the middlewares again, giving the opportunity within every step to
modify or enrich the current request, context, or the response.

## Execution order

Middlewares have two phases: `before` and `after`.

The `before` phase, happens _before_ the handler is executed. In this code the
response is not created yet, so you will have access only to the request.

The `after` phase, happens _after_ the handler is executed. In this code you will
have access to both the request and the response.

If you have three middlewares attached (as in the image above), this is the expected
order of execution:

- `middleware1` (before)
- `middleware2` (before)
- `middleware3` (before)
- `handler`
- `middleware3` (after)
- `middleware2` (after)
- `middleware1` (after)

Notice that in the `after` phase, middlewares are executed in inverted order,
this way the first handler attached is the one with the highest priority as it will
be the first able to change the request and last able to modify the response before
it gets sent to the user.

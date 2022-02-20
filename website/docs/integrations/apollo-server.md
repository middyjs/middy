---
title: Apollo Server
---

:::caution

This page is a work in progress. If you want to help us to make this page better, please consider contributing on GitHub.

:::


```javascript
import middy from '@middy/core'
import { ApolloServer, gql } from 'apollo-server-lambda'
import { buildFederatedSchema } from '@apollo/federation'
import { resolvers } from './graphql/resolvers.js'
import { graphqlFileToStr } from './graphql/schema.js'

const graphQL = new ApolloServer({
  schema: buildFederatedSchema({
    typeDefs: gql(graphqlFileToStr),
    resolvers
  })
})

// Do not use: `@middy/http-json-body-parser` it is already handled within apollo
export const handler = middy(graphQL.createHandler())
```

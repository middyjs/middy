import { ApolloServer, gql } from 'apollo-server-lambda'
import { buildFederatedSchema } from '@apollo/federation'
import middy from '@middy/core'
import { resolvers } from './graphql/resolvers.js'
import { graphqlFileToStr } from './graphql/schema.js'

const typeDefs = gql(graphqlFileToStr)

const server = new ApolloServer({
  schema: buildFederatedSchema({
    typeDefs,
    resolvers,
  })
})

const graphqlHandler = server.createHandler()

// Do not use: `@middy/http-json-body-parser` it is already handled within apollo
const handler = middy(graphqlHandler)

export { handler as apolloServer }

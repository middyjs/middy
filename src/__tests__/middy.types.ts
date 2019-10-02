import middy from '../../';

describe('🛵  Middy types test suite', () => {
  test('"before" should take a function', () => {
    const beforeMiddleware = jest.fn();

    const handler = middy(jest.fn());

    handler.before(beforeMiddleware);
  })

  test('"after" should take a function', () => {
    const afterMiddleware = jest.fn();

    const handler = middy(jest.fn());

    handler.after(afterMiddleware);
  })

  test('"onError" should take a function', () => {
    const errorMiddleware = jest.fn();

    const handler = middy(jest.fn());

    handler.onError(errorMiddleware);
  })

  test('middleware calls can be chained', () => {
    const before = jest.fn()
    const after = jest.fn()
    const onError = jest.fn();

    const middleware = () => ({
      after,
      before,
      onError,
     });

    const handler = middy(jest.fn());

     handler
      .use(middleware())
      .after(after)
      .before(before)
      .onError(onError);
  })
})

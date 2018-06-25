import middy from '../../../';
import { cors } from '../../../middlewares';

describe('📦 Middleware Types', () => {
  describe('CORS', () => {
    it('has an optional argument', () => {
      const handler = middy(jest.fn());
      handler.use(cors());
    })

    it('can set the origin field', () => {
      const handler = middy(jest.fn());
      handler.use(cors({
        origin: '*',
      }));
    })

    it('can set the origins field', () => {
      const handler = middy(jest.fn());
      handler.use(cors({
        origins: ['example.com', 'example2.com'],
      }))
    })

    it('can set the headers field', () => {
      const handler = middy(jest.fn());
      handler.use(cors({
        headers: 'test-case',
      }));
    })

    it('can set the credentials field', () => {
      const handler = middy(jest.fn());
      handler.use(cors({
        credentials: true,
      }));
    })
  })
});

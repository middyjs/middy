import middy from '../../../';
import { cors } from '../../../middlewares';

describe('📦 Middleware Types', () => {
  describe('CORS', () => {
    it('has an optional argument', () => {
      const handler = middy(jest.fn());
      handler.use(cors());
    })

    it ('has an optional origin field', () => {
      const handler = middy(jest.fn());
      handler.use(cors({
        headers: "test-case",
        credentials: true,
      }));
    })

    it('has an optional headers field', () => {
      const handler = middy(jest.fn());
      handler.use(cors({
        origin: 'example.com',
        credentials: true,
      }));
    })

    it('has an optional credentials field', () => {
      const handler = middy(jest.fn());
      handler.use(cors({
        origin: 'example.com',
        headers: "test-case",
      }));
    })
  })
});

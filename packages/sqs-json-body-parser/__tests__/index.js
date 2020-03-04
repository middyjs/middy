const eventMocks = require('@serverless/event-mocks').default
const middy = require('../../core')
const sqsJsonBodyParser = require('../')

describe('middleware/sqsJsonBodyParser >', function() {
  let opts;
  let bodyParser;
  let nextStub;
  let event;

  beforeEach(function() {
    opts = undefined;
    bodyParser = sqsJsonBodyParser(opts);
    nextStub = jest.fn();
    event = eventMocks('aws:sqs');
  });

  describe('as function >', function() {
    let handler;

    beforeEach(function() {
      sinon.spy(JSON, 'parse');

      handler = { event };
    });

    it('handles empty event object', function() {
      handler = {};
      bodyParser.before(handler, nextStub);

      sinon.assert.notCalled(JSON.parse);
      sinon.assert.calledOnce(nextStub);
    });

    it('handles empty Records array', function() {
      handler = { event: {} };
      bodyParser.before(handler, nextStub);

      sinon.assert.notCalled(JSON.parse);
      sinon.assert.calledOnce(nextStub);
    });

    it('parses each body payload', function() {
      const body = '{}';
      handler.event.Records[0].body = body;
      bodyParser.before(handler, nextStub);

      sinon.assert.calledOnce(JSON.parse);
      sinon.assert.calledWith(JSON.parse, body, undefined);
      expect(handler.event.Records[0].body).to.be.an('object');
      sinon.assert.calledOnce(nextStub);
    });

    it('calls reviver when provided', function() {
      const body = '{}';
      handler.event.Records[0].body = body;
      const reviver = sinon.stub();
      opts = { reviver };
      bodyParser = sqsJsonBodyParser(opts);

      bodyParser.before(handler, nextStub);

      sinon.assert.calledOnce(JSON.parse);
      sinon.assert.calledWith(JSON.parse, body, reviver);
      sinon.assert.calledOnce(reviver);
    });

    it('calls handleError when parse error', function() {
      const { body } = handler.event.Records[0];
      const str = 'jibberish';
      const handleError = sinon.stub().returns(str);
      opts = { handleError };
      bodyParser = sqsJsonBodyParser(opts);

      bodyParser.before(handler, nextStub);

      sinon.assert.threw(JSON.parse);
      sinon.assert.calledOnce(handleError);
      sinon.assert.calledWith(handleError, sinon.match.instanceOf(Error), body);
      sinon.assert.calledOnce(nextStub);
      expect(handler.event.Records[0].body).to.equal(str);
    });

    it('breaks and throws when handleError does', function() {
      const { body } = handler.event.Records[0];
      const handleError = sinon.stub().throws();
      opts = { handleError };
      bodyParser = sqsJsonBodyParser(opts);

      try {
        bodyParser.before(handler, nextStub);
      } catch (err) {}

      sinon.assert.threw(JSON.parse);
      sinon.assert.calledOnce(handleError);
      sinon.assert.calledWith(handleError, sinon.match.instanceOf(Error), body);
      sinon.assert.notCalled(nextStub);
    });

    it('handleError is not a function', function() {
      const { body } = handler.event.Records[0];
      const handleError = 'zig zap zip zoom';
      opts = { handleError };
      bodyParser = sqsJsonBodyParser(opts);

      bodyParser.before(handler, nextStub);

      sinon.assert.threw(JSON.parse);
      expect(handler.event.Records[0].body)
        .to.be.a('string')
        .that.equals(body);
      sinon.assert.calledOnce(nextStub);
    });
  });

  describe('as middleware > ', function() {
    let callbackStub;
    let originalHanldlerStub;
    let handler;

    beforeEach(function() {
      callbackStub = sinon.stub();
      originalHanldlerStub = sinon.stub();
      handler = middy(originalHanldlerStub);

      sinon.spy(bodyParser, 'before');

      handler.use(bodyParser);
    });

    it('parses the body', function() {
      const body = '{}';
      event.Records[0].body = body;

      handler(event, {}, callbackStub);

      sinon.assert.calledOnce(bodyParser.before);

      expect(event.Records[0].body)
        .to.be.an('object')
        .and.to.eql({});
    });

    it('parses all bodys', function() {
      const bodys = ['{}', '{}'];
      const record = { ...event.Records[0] };
      event.Records.push(record);

      bodys.forEach((body, idx) => {
        event.Records[idx].body = body;
      });

      handler(event, {}, callbackStub);

      sinon.assert.calledOnce(bodyParser.before);

      event.Records.forEach(rcd => {
        expect(rcd.body)
          .to.be.an('object')
          .and.to.eql({});
      });
    });

    it('keeps body unmodified when not handleError option', function() {
      const { body } = event.Records[0];

      handler(event, {}, callbackStub);

      sinon.assert.calledOnce(bodyParser.before);

      expect(event.Records[0].body)
        .to.be.a('string')
        .and.to.equal(body);
    });

    it('keeps body unmodified when handleError throws', function() {
      const { body } = event.Records[0];

      opts = { handleError: sinon.stub().throws() };
      bodyParser = sqsJsonBodyParser(opts);

      sinon.spy(bodyParser, 'before');

      handler = middy(originalHanldlerStub);

      handler.use(bodyParser);

      handler(event, {}, callbackStub);

      sinon.assert.calledOnce(bodyParser.before);

      expect(event.Records[0].body)
        .to.be.a('string')
        .and.to.equal(body);
    });

    it('sets body to whatever handleError returns', function() {
      const newBody = Math.random();

      opts = { handleError: sinon.stub().returns(newBody) };
      bodyParser = sqsJsonBodyParser(opts);

      sinon.spy(bodyParser, 'before');

      handler = middy(originalHanldlerStub);

      handler.use(bodyParser);

      handler(event, {}, callbackStub);

      sinon.assert.calledOnce(bodyParser.before);

      expect(event.Records[0].body)
        .to.be.a('number')
        .and.to.equal(newBody);
    });
  });
});

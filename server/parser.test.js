const http = require('http');

jest.mock('./parser', () => ({
  parseOrderTranscript: jest.fn(),
  writeKitchenDocket: jest.fn(),
  writeBookingDocket: jest.fn(),
}));

const {
  parseOrderTranscript,
  writeKitchenDocket,
  writeBookingDocket,
} = require('./parser');

const app = require('./app');

function postOrder(server, payload) {
  const address = server.address();
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: '/order',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let responseBody = '';

        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: JSON.parse(responseBody),
          });
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

describe('POST /order', () => {
  let server;

  beforeAll((done) => {
    server = app.listen(0, done);
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('processes identical simultaneous transcripts only once', async () => {
    parseOrderTranscript.mockResolvedValue({
      intent: 'food_order',
      order_details: {
        items: [
          {
            name: 'Spicy fried squid',
            quantity: 1,
            modifications: [],
          },
        ],
      },
      booking_details: null,
      error_message: null,
    });
    writeKitchenDocket.mockResolvedValue(undefined);

    const payload = { transcript: 'please give me an order of spicy fried squid' };
    const [firstResponse, secondResponse] = await Promise.all([
      postOrder(server, payload),
      postOrder(server, payload),
    ]);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(parseOrderTranscript).toHaveBeenCalledTimes(1);
    expect(writeKitchenDocket).toHaveBeenCalledTimes(1);
    expect(writeBookingDocket).not.toHaveBeenCalled();
    expect([firstResponse.body.duplicate, secondResponse.body.duplicate]).toContain(true);
  });

  test('rejects blank transcripts before calling the parser', async () => {
    const response = await postOrder(server, { transcript: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(parseOrderTranscript).not.toHaveBeenCalled();
  });
});

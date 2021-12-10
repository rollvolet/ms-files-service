import { app, errorHandler } from 'mu';
import { getSessionIdHeader, error } from './utils';
import GraphApiClient from './graph-api';

app.get('/ping', async function(req, res, next) {
  const sessionUri = getSessionIdHeader(req);
  if (!sessionUri)
    return next(new Error('Session header is missing'));

  try {
    const client = new GraphApiClient(sessionUri);
    await client.me();
    return res.status(204).send();
  } catch(e) {
    console.trace(e);
    return next(new Error(e.message));
  }
});

app.use(errorHandler);

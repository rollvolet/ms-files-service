import { app, errorHandler } from 'mu';
import fileUpload from 'express-fileupload';
import { getSessionIdHeader, error } from './utils';
import GraphApiClient from './graph-api';
import { insertUploadedFile, linkAttachmentToCase } from './sparql';

app.use(fileUpload());

app.get('/me', async function(req, res, next) {
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

app.post('/cases/:caseId/attachments', async function(req, res, next) {
  const sessionUri = getSessionIdHeader(req);
  if (!sessionUri)
    return next(new Error('Session header is missing'));

  try {
    const caseId = req.params.caseId;
    const client = new GraphApiClient(sessionUri);
    const uploadedFile = await client.uploadCaseAttachment(caseId, req.files.file);
    const file = await insertUploadedFile(uploadedFile);
    await linkAttachmentToCase(file.uri, caseId);
    return res.status(201).send({
      data: {
        id: file.id,
        type: 'files',
        attributes: {
          uri: file.uri,
          name: file.name,
          format: file.format,
          size: file.size,
          extension: file.extension,
          created: file.created.toISOString()
        }
      }
    });
  } catch(e) {
    console.trace(e);
    return next(new Error(e.message));
  }
});

app.use(errorHandler);

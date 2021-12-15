import { app, errorHandler } from 'mu';
import fileUpload from 'express-fileupload';
import { getSessionIdHeader, error } from './utils';
import GraphApiClient from './graph-api';
import {
  insertUploadedFile,
  getMsFileId,
  deleteFile,
  linkAttachmentToCase
} from './sparql';

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

app.delete('/files/:id', async function(req, res, next) {
  const sessionUri = getSessionIdHeader(req);
  if (!sessionUri)
    return next(new Error('Session header is missing'));

  try {
    const fileId = req.params.id;
    const msFileId = await getMsFileId(fileId);
    if (msFileId) {
      const client = new GraphApiClient(sessionUri);
      try {
        await client.deleteFile(msFileId);
      } catch (e) {
        console.log(`Failed to delete file from drive, but will still continue to remove file from triplestore`);
      }
      await deleteFile(fileId);
      return res.status(204).send();
    } else {
      console.log(`No MS fileId found in triplestore for file with id ${fileId}`);
      return res.status(404).send();
    }
  } catch(e) {
    console.trace(e);
    return next(new Error(e.message));
  }
});

app.use(errorHandler);

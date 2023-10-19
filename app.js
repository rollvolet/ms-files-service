import httpContext from 'express-http-context';
import { app, errorHandler } from 'mu';
import fileUpload from 'express-fileupload';
import { getSessionIdHeader, error } from './utils';
import { FILE_TYPES, getDownloadLocation } from './upload-location';
import GraphApiClient from './graph-api';
import FileDropHandler from './file-drop-handler';
import { uploadCaseDocument } from './file-upload';
import { getFileId, getMsFileId, deleteFile } from './sparql';

app.use(fileUpload());

// Copied from mu-javascript-template since the httpContext middleware
// must be included  after the express-fileupload middleware.
// If not, the express-fileupload breaks the httpContext. As a consequence,
// mu-auth-allowed headers are not correctly set on SPARQL queries to database.
app.use(httpContext.middleware);
app.use(function(req, res, next) {
  httpContext.set('request', req);
  httpContext.set('response', res);
  next();
});
// end copy from mu-javascript-template

const fileDropHandler = new FileDropHandler();
fileDropHandler.listen();

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
  if (!req.files.file)
    return next(new Error('File parameter is missing'));

  try {
    const file = await uploadCaseDocument(
      req.params.caseId,
      FILE_TYPES.CASE_ATTACHMENT,
      req.files.file,
      new GraphApiClient(sessionUri)
    );
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


app.post('/cases/:caseId/production-tickets', async function(req, res, next) {
  const sessionUri = getSessionIdHeader(req);
  if (!sessionUri)
    return next(new Error('Session header is missing'));
  if (!req.files.file)
    return next(new Error('File parameter is missing'));

  try {
    const file = await uploadCaseDocument(
      req.params.caseId,
      FILE_TYPES.PRODUCTION_TICKET,
      req.files.file,
      new GraphApiClient(sessionUri)
    );
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

app.get('/files/:id/download', async function(req, res, next) {
  const sessionUri = getSessionIdHeader(req);
  if (!sessionUri)
    return next(new Error('Session header is missing'));

  try {
    const fileId = req.params.id;
    const msFileId = await getMsFileId(fileId);
    if (msFileId) {
      const client = new GraphApiClient(sessionUri);
      const downloadUrl = await client.getDownloadUrl(msFileId);
      if (downloadUrl) {
        return res.location(downloadUrl).status(204).send();
      } else {
        console.log(`File with id ${fileId} found in triplestore, but no file with MS fileId ${msFileId} found on drive.`);
        return res.status(404).send();
      }
    } else {
      console.log(`No MS fileId found in triplestore for file with id ${fileId}`);
      return res.status(404).send();
    }
  } catch(e) {
    console.trace(e);
    return next(new Error(e.message));
  }
});

app.get('/downloads', async function(req, res, next) {
  const sessionUri = getSessionIdHeader(req);
  if (!sessionUri)
    return next(new Error('Session header is missing'));

  try {
    const resource = req.query.resource;
    const documentType = req.query.type;
    const location = await getDownloadLocation(documentType, { resource });
    const client = new GraphApiClient(sessionUri);
    const msFileId = await client.findFileByLocation(location);
    if (msFileId) {
      const downloadUrl = await client.getDownloadUrl(msFileId);
      return res.location(downloadUrl).status(204).send();
    } else {
      return res.status(404).send();
    }
  } catch(e) {
    console.trace(e);
    return next(new Error(e.message));
  }
});

app.delete('/downloads', async function(req, res, next) {
  const sessionUri = getSessionIdHeader(req);
  if (!sessionUri)
    return next(new Error('Session header is missing'));

  try {
    const resource = req.query.resource;
    const documentType = req.query.type;
    const location = await getDownloadLocation(documentType, { resource });
    const client = new GraphApiClient(sessionUri);
    const msFileId = await client.findFileByLocation(location);
    if (msFileId) {
      try {
        await client.deleteFile(msFileId);
      } catch (e) {
        console.log(`Failed to delete file from drive, but will still continue to remove file from triplestore`);
      }
      const fileId = await getFileId(msFileId);
      if (fileId) {
        await deleteFile(fileId);
      }
    }
    return res.status(204).send();
  } catch(e) {
    console.trace(e);
    return next(new Error(e.message));
  }
});

app.use(errorHandler);

import httpContext from 'express-http-context';
import { app, errorHandler } from 'mu';
import fileUpload from 'express-fileupload';
import { getSessionIdHeader, error } from './utils';
import { FILE_TYPES, getUploadLocations } from './upload-location';
import GraphApiClient from './graph-api';
import FileDropHandler from './file-drop-handler';
import {
  insertUploadedFile,
  getMsFileId,
  deleteFile,
  fetchInvoice
} from './sparql';

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

const DOCUMENT_TYPES = {
  INVOICE: 'http://data.rollvolet.be/concepts/3abc9905-29b9-47f2-a77d-e94a4025f8c3',
  DEPOSIT_INVOICE: 'http://data.rollvolet.be/concepts/5c93373f-30f3-454c-8835-15140ff6d1d4'
};

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
    const caseId = req.params.caseId;
    const client = new GraphApiClient(sessionUri);
    const { data, size, name } = req.files.file;
    const [{ path, name: fileName }] = await getUploadLocations(FILE_TYPES.CASE_ATTACHMENT, {
      case: { id: caseId },
      fileName: name,
    });
    const uploadedFile = await client.uploadFile(path, fileName, data, size);
    const file = await insertUploadedFile(uploadedFile, {
      case: { id: caseId },
      type: FILE_TYPES.CASE_ATTACHMENT
    });
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
      return res.location(downloadUrl).status(204).send();
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
    const [{ path, name }] = await getUploadLocations(documentType, { resource });
    const client = new GraphApiClient(sessionUri);
    const downloadUrl = await client.getDownloadUrlByFilePath(path, name);
    if (downloadUrl) {
      return res.location(downloadUrl).status(204).send();
    } else {
      return res.status(404).send();
    }
  } catch(e) {
    console.trace(e);
    return next(new Error(e.message));
  }
});

app.use(errorHandler);

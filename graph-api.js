import 'isomorphic-fetch';
import * as fs from 'node:fs/promises';
import { Client, LargeFileUploadTask, FileUpload } from '@microsoft/microsoft-graph-client';
import MuAuthenticationProvider from './mu-authentication-provider';

const MS_DRIVE_ID = process.env.MS_DRIVE_ID;

/**
 * Client to interact with the MS Graph API. Requests are executed on behalf of a user.
 * The client uses the mu-authentication-provider which fetches an access-token from
 * the triplestore based on the user's session.
 *
 * Note: This client is not responsible for inserting/deleting data in the triplestore,
 * only for interacting with the O365 Cloud using the Graph API.
*/
export default class GraphApiClient {
  constructor(sessionUri) {
    this.client = Client.initWithMiddleware({
      authProvider: new MuAuthenticationProvider(sessionUri)
    });
  }

  async me() {
    const response = await this.client.api('/me').get();
    console.log('Retrieved my profile');
    console.log(response);
  }

  /**
   * Find the MS fileId of a file in the given directory on the O365 drive
  */
  async findFileByLocation({ path, name, search }) {
    if (search) {
      const driveItem = await this.client.api(`/drives/${MS_DRIVE_ID}/root:${path}`).select('id').get();
      if (driveItem) {
        const searchResult = await this.client
              .api(`/drives/${MS_DRIVE_ID}/items/${driveItem.id}/search(q='${search}')`)
              .top(1)
              .select('id,name')
              .get();
        return searchResult['value'][0]?.id;
      } else {
        console.log(`Cannot find directory ${path} on drive ${MS_DRIVE_ID}.`);
        return null;
      }
    } else {
      const filePath = `${path}/${name}`;
      try {
        const response = await this.client
              .api(`/drives/${MS_DRIVE_ID}/root:${filePath}`)
              .select('id,name')
              .get();
        return response['id'];
      } catch (e) {
        if (e.code == 'itemNotFound') {
          console.log(`File at path ${filePath} not found on drive ${MS_DRIVE_ID}.`);
          return null;
        } else {
          console.log(`Failed to find file with path ${filePath} on drive ${MS_DRIVE_ID}`);
          throw e;
        }
      }
    }
  }

  /**
   * Delete the file with the given MS fileId from the O365 drive.
  */
  async deleteFile(fileId) {
    try {
      await this.client
        .api(`/drives/${MS_DRIVE_ID}/items/${fileId}`)
        .delete();
      console.log(`Deleting file with id ${fileId} from drive ${MS_DRIVE_ID} succeeded.`);
    } catch (e) {
      console.log(`Failed to delete file with id ${fileId} from drive ${MS_DRIVE_ID}`);
      throw e;
    }
  }

  /**
   * Get a temporary download URL for the file with the given MS fileId from the O365 drive.
  */
  async getDownloadUrl(fileId) {
    try {
      const response = await this.client
            .api(`/drives/${MS_DRIVE_ID}/items/${fileId}`)
            .select('@microsoft.graph.downloadUrl')
            .get();
      return response['@microsoft.graph.downloadUrl'];
    } catch (e) {
      if (e.code == 'itemNotFound') {
        console.log(`File with id ${fileId} not found on drive ${MS_DRIVE_ID}. Unable to download.`);
        return null;
      } else {
        console.log(`Failed to download file with id ${fileId} from drive ${MS_DRIVE_ID}`);
        throw e;
      }
      throw e;
    }
  }

  /**
   * Upload a file on the given path to the O365 drive.
  */
  uploadFile(path, filename, content, filesize, opts) {
    const fullPath = `${path}/${filename}`;
    const fileObject = new FileUpload(content, filename, filesize);
    return this.uploadFileObject(fullPath, fileObject, opts);
  }

  /**
   * Upload a file from the local drive to a given path on the 0365 drive.
   */
  async uploadLocalFile(targetPath, targetName, localFile, opts) {
    const [content, stats] = await Promise.all([fs.readFile(localFile), fs.stat(localFile)]);
    const size = stats.size;
    return this.uploadFile(targetPath, targetName, content, size, opts);
  }

  /**
   * @private
  */
  async uploadFileObject(filePath, fileObject, opts) {
    const url = `/drives/${MS_DRIVE_ID}/root:${filePath}:/createUploadSession`;
    const body = {
      item: {
        '@microsoft.graph.conflictBehavior': opts?.conflictBehavior ?? 'rename' // one of 'fail', 'replace', 'rename'
      }
    };
    const uploadSession = await LargeFileUploadTask.createUploadSession(this.client, url, body);
    const options = {
      rangeSize: 320 * 1024, // must be a multiple of 320 KiB
      uploadEventHandlers: {
        progress(range) {
          console.log(`Upload in progress: [${range.minValue}-${range.maxValue}] bytes of content uploaded`);
        }
      }
    };

    console.log(`Starting upload file to drive ${MS_DRIVE_ID} on path ${filePath}`);
    const uploadTask = new LargeFileUploadTask(this.client, fileObject, uploadSession, options);

    try {
      const uploadResult = await uploadTask.upload();
      console.log(`Uploading file to drive ${MS_DRIVE_ID} on path ${filePath} succeeded. Item id: ${uploadResult.responseBody.id}`);
      return {
        id: uploadResult.responseBody.id,
        name: uploadResult.responseBody.name,
        url: uploadResult.responseBody.webUrl,
        size: uploadResult.responseBody.size,
        format: uploadResult.responseBody.file.mimeType,
        created: new Date(Date.parse(uploadResult.responseBody.createdDateTime)),
        modified: new Date(Date.parse(uploadResult.responseBody.lastModifiedDateTime))
      };
    } catch (e) {
      console.log(`Uploading file to drive ${MS_DRIVE_ID} on path ${filePath} failed`);
      throw e;
    }
  }
}

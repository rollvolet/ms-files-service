import 'isomorphic-fetch';
import { Client, LargeFileUploadTask, FileUpload } from "@microsoft/microsoft-graph-client";
import MuAuthenticationProvider from './mu-authentication-provider';

const MS_DRIVE_ID = process.env.MS_DRIVE_ID;

const ATTACHMENTS_FOLDER = process.env.ATTACHMENTS_FOLDER || 'crm-development/attachments';

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
   * Upload the given file as an attachment for the case with the given caseId.
   * The file gets uploaded on the O365 drive in the configured ATTACHMENTS_FOLDER per case.
  */
  async uploadCaseAttachment(caseId, file) {
    const filename = file.name; // TODO character espacing?
    const filePath = `/${ATTACHMENTS_FOLDER}/${caseId}/${filename}`;
    const fileObject = new FileUpload(file.data, file.name, file.size);
    const uploadedFile = await this.uploadFile(filePath, fileObject);
    return uploadedFile;
  }

  /**
   * Delete the file with the given MS fileId from the O365 drive.
  */
  async deleteFile(fileId) {
    try {
      await this.client.api(`/drives/${MS_DRIVE_ID}/items/${fileId}`).delete();
    } catch (e) {
      console.log(`Failed to delete file with id ${fileId} from drive ${MS_DRIVE_ID}`);
      throw e;
    }
  }

  /**
   * @private
  */
  async uploadFile(filePath, fileObject) {
    const url = `/drives/${MS_DRIVE_ID}/root:${filePath}:/createUploadSession`;
    const body = {
      item: {
        '@microsoft.graph.conflictBehavior': 'rename'
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

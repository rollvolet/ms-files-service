import 'isomorphic-fetch';
import { Client, LargeFileUploadTask, FileUpload } from "@microsoft/microsoft-graph-client";
import MuAuthenticationProvider from './mu-authentication-provider';

const MS_DRIVE_ID = process.env.MS_DRIVE_ID;

const ATTACHMENTS_FOLDER = process.env.ATTACHMENTS_FOLDER || 'crm-development/attachments';

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

  async uploadCaseAttachment(caseId, file) {
    const filename = file.name; // TODO character espacing?
    const filePath = `/${ATTACHMENTS_FOLDER}/${caseId}/${filename}`;
    const fileObject = new FileUpload(file.data, file.name, file.size);
    const uploadedFile = await this.uploadFile(filePath, fileObject);
    return uploadedFile;
  }

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
      console.trace(e);
      throw e;
    }
  }
}

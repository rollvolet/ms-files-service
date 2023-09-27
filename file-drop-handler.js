import * as fs from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { getActiveSessionForFileCreator, moveUploadedFile } from './sparql';
import { getUploadLocation } from './upload-location';
import GraphApiClient from './graph-api';

const FILE_DROP_SYNC_INTERVAL_MS = parseInt(process.env.FILE_DROP_SYNC_INTERVAL_MS || '10000');
const FILE_DROP_DIRECTORY = '/upload';
const FAILED_DROP_DIRECTORY = `${FILE_DROP_DIRECTORY}/failed`;

export default class FileDropHandler {
  queue = [];
  current = null; // name of the file currently being processed from the queue

  constructor() {
    [FILE_DROP_DIRECTORY, FAILED_DROP_DIRECTORY].forEach((directory) => {
      if (!existsSync(directory)) {
        mkdirSync(directory);
      }
    });
  }

  get isHandling() {
    return this.current != null;
  }

  async listen() {
    let newFileCount = 0;
    console.debug(`Checking ${FILE_DROP_DIRECTORY} for new dropped files.`);
    const files = await fs.readdir(FILE_DROP_DIRECTORY, { withFileTypes: true });
    files
      .filter((f) => f.isFile()) // exclude directories
      .filter((f) => !f.name.startsWith('.')) // exclude hidden files
      .forEach((file) => {
      const isNew = this.addToQueue(file.name);
      if (isNew) {
        newFileCount++;
      }
    });
    if (newFileCount) {
      console.log(`Added ${newFileCount} new file(s) to the queue.`);
      this.handleNextFile();
    } else {
      console.debug(`No new files detected`);
    }
    setTimeout(() => this.listen(), FILE_DROP_SYNC_INTERVAL_MS);
  }

  async handleNextFile() {
    if (this.queue.length) {
      if (this.isHandling) {
        console.log(`File drop handler is already busy processing the queue.`);
      } else {
        this.current = this.queue.shift();
        const filePath = `${FILE_DROP_DIRECTORY}/${this.current}`;
        console.log(`Handling next file from the queue: ${filePath}`);
        try {
          await this.uploadFile(filePath);
          await fs.rm(filePath, { force: true });
        } catch (e) {
          console.log(`Something went wrong while uploading file ${filePath}.`);
          console.log(`${e}`);
          console.log(`Going to ignore this one and continue processing the queue.`);
          const failurePath = filePath.replace(FILE_DROP_DIRECTORY, FAILED_DROP_DIRECTORY);
          await fs.rename(filePath, failurePath);
        }
        this.current = null;
        this.handleNextFile();
      }
    } else {
      console.log(`Queue is empty. No files to handle at the moment.`);
    }
  }

  addToQueue(fileName) {
    const isNew = [this.current, ...this.queue].indexOf(fileName) == -1;
    if (isNew) {
      this.queue.push(fileName);
      return true;
    } else {
      return false;
    }
  }

  async uploadFile(file) {
    const fileUri = file.replace(`${FILE_DROP_DIRECTORY}/`, 'share://');
    const { path: uploadPath, name: uploadName } = await getUploadLocation(fileUri);

    const sessionUri = await getActiveSessionForFileCreator(fileUri);
    if (sessionUri) {
      const graphApiClient = new GraphApiClient(sessionUri);
      const uploadedFile = await graphApiClient.uploadLocalFile(uploadPath, uploadName, file);
      await moveUploadedFile(fileUri, uploadedFile);
    } else {
      throw new Error(`No active session with a valid access token found for creator of file ${fileUri}. Unable to upload the file to the cloud.`);
    }
  }
}

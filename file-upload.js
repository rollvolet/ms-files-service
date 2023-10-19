import { insertUploadedFile } from './sparql';
import { getUploadLocations } from './upload-location';

export async function uploadCaseDocument(caseId, fileType, uploadedFile, graphApiClient) {
  const { data, size, name } = uploadedFile;
  const [{ path, name: fileName }] = await getUploadLocations(fileType, {
    case: { id: caseId },
    fileName: name,
  });
  const graphApiFile = await graphApiClient.uploadFile(path, fileName, data, size);
  const file = await insertUploadedFile(graphApiFile, {
    case: { id: caseId },
    type: fileType
  });

  return file;
}

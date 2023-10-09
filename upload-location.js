import { getFileType, getCaseIdentifier } from './sparql';

const ACCOUNTANCY_EXPORT_DIR = process.env.ACCOUNTANCY_EXPORT_DIR || '/crm-development/winbooks';
const CASE_ATTACHMENT_DIR = process.env.CASE_ATTACHMENT_DIR || '/crm-development/attachments';

export const FILE_TYPES = {
  CASE_ATTACHMENT: 'http://data.rollvolet.be/concepts/44e7a6a6-b0e6-4a9c-ae4c-1f66275f730d',
  INVOICE_ACCOUNTANCY_EXPORT: 'http://data.rollvolet.be/concepts/6fbc15d2-11c0-4868-8b11-d15b8f1a3802',
  CUSTOMER_ACCOUNTANCY_EXPORT: 'http://data.rollvolet.be/concepts/7afecda8-f128-4043-a69c-a68cbaaedac5'
};

export async function getUploadLocationsForType(type, opts) {
  if (type == FILE_TYPES.CASE_ATTACHMENT) {
    const caseIdentifier = await getCaseIdentifier(opts.case.id);
    return [
      { path: `${CASE_ATTACHMENT_DIR}/${caseIdentifier}`, name: opts.filename },
    ];
  } else {
    throw new Error(`Upload location not yet implemented for file type '${type}'`);
  }
}

export async function getUploadLocationsForFile(fileUri) {
  const type = await getFileType(fileUri);
  if (type == FILE_TYPES.INVOICE_ACCOUNTANCY_EXPORT) {
    const timestamp = new Date().toISOString()
          .substr(0, 'yyyy-MM-DDTHH:mm:ss'.length)
          .replaceAll(/[^0-9]/g, '');
    return [
      { path: ACCOUNTANCY_EXPORT_DIR, name: 'ACT.csv' },
      { path: ACCOUNTANCY_EXPORT_DIR, name: `${timestamp}-ACT.csv` }
    ];
  } else if (type == FILE_TYPES.CUSTOMER_ACCOUNTANCY_EXPORT) {
    const timestamp = new Date().toISOString()
          .substr(0, 'yyyy-MM-DDTHH:mm:ss'.length)
          .replaceAll(/[^0-9]/g, '');
    return [
      { path: ACCOUNTANCY_EXPORT_DIR, name: 'CSF.csv' },
      { path: ACCOUNTANCY_EXPORT_DIR, name: `${timestamp}-CSF.csv` }
    ];
  } else {
    throw new Error(`Upload location not yet implemented for file <${fileUri}> with type '${type}'`);
  }
}

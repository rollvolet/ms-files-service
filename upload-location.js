import { getFileType } from './sparql';

const ACCOUNTANCY_EXPORT_DIR = process.env.ACCOUNTANCY_EXPORT_DIR || '/crm-development/winbooks';

export const FILE_TYPES = {
  INVOICE_ACCOUNTANCY_EXPORT: 'http://data.rollvolet.be/concepts/6fbc15d2-11c0-4868-8b11-d15b8f1a3802',
  CUSTOMER_ACCOUNTANCY_EXPORT: 'http://data.rollvolet.be/concepts/7afecda8-f128-4043-a69c-a68cbaaedac5'
};

export async function getUploadLocation(fileUri) {
  const type = await getFileType(fileUri);
  let path, name = null;

  if (type == FILE_TYPES.INVOICE_ACCOUNTANCY_EXPORT) {
    path = ACCOUNTANCY_EXPORT_DIR;
    name = 'ACT.csv';
  } else if (type == FILE_TYPES.CUSTOMER_ACCOUNTANCY_EXPORT) {
    path = ACCOUNTANCY_EXPORT_DIR;
    name = 'CSF.csv';
  } else {
    throw new Error(`Upload location not yet implemented for file type '${type}'`);
  }

  return { path, name };
}

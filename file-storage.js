const ATTACHMENTS_FOLDER = process.env.ATTACHMENTS_FOLDER || 'crm-development/attachments';
const INVOICE_STORAGE_LOCATION = process.env.INVOICE_STORAGE_LOCATION || '/General/Administratie/facturen';

function getAttachmentFilePath(_case, filename) {
  return {
    path: `/${ATTACHMENTS_FOLDER}/${_case.id}/${filename}`,
    name: filename
  };
}

function getInvoiceFilePath(invoice) {
  const year = invoice.date.getFullYear() || 0;
  const filename = `F0${invoice.number}`.replace(/\W/g, '') + '.pdf';
  const path = `${INVOICE_STORAGE_LOCATION}/${year}/${filename}`;
  return { path, name: filename };
}

export {
  getAttachmentFilePath,
  getInvoiceFilePath
}

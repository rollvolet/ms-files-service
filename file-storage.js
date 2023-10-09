const INVOICE_STORAGE_LOCATION = process.env.INVOICE_STORAGE_LOCATION || '/General/Administratie/facturen';

function getInvoiceFilePath(invoice) {
  const year = invoice.date.getFullYear() || 0;
  const filename = `F0${invoice.number}`.replace(/\W/g, '') + '.pdf';
  const path = `${INVOICE_STORAGE_LOCATION}/${year}`;
  return { path, name: filename };
}

export {
  getInvoiceFilePath
}

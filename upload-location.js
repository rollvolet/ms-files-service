import { getFileType } from './sparql';
import { query, sparqlEscapeString, sparqlEscapeUri } from 'mu';
import { querySudo } from '@lblod/mu-auth-sudo';

const VISIT_REPORT_DIR = process.env.VISIT_REPORT_DIR || '/crm-development/visit-reports';
const INVOICE_DIR = process.env.INVOICE_DIR || '/crm-development/invoices';
const CASE_ATTACHMENT_DIR = process.env.CASE_ATTACHMENT_DIR || '/crm-development/attachments';
const ACCOUNTANCY_EXPORT_DIR = process.env.ACCOUNTANCY_EXPORT_DIR || '/crm-development/winbooks';

export const FILE_TYPES = {
  VISIT_REPORT: 'http://data.rollvolet.be/concepts/f5b9c371-a0ed-4476-90a1-3e73d5d4f09e',
  DEPOSIT_INVOICE: 'http://data.rollvolet.be/concepts/5c93373f-30f3-454c-8835-15140ff6d1d4',
  INVOICE: 'http://data.rollvolet.be/concepts/3abc9905-29b9-47f2-a77d-e94a4025f8c3',
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

/**
 * Returns one or more locations a file with a given URI should be uploaded to.
 * The location depends on the type of the file.
 * Multiple locations may be returned. The first one is considered to be the 'main' location.
 * Other locations are just copies of the same file and will not be tracked in the triplestore.
*/
export async function getUploadLocationsForFile(fileUri) {
  const type = await getFileType(fileUri);
  if (type == FILE_TYPES.VISIT_REPORT) {
    const { year, number } = await getVisitReportInfo(fileUri);
    return [
      { path: `${VISIT_REPORT_DIR}/${year}`, name: `AD${number}.pdf`}
    ];
  } else if (type == FILE_TYPES.INVOICE || type == FILE_TYPES.DEPOSIT_INVOICE) {
    const { year, number } = await getInvoiceInfo(fileUri);
    const normalizedNumber = `${number}`.padStart(7, 0);
    return [
      { path: `${INVOICE_DIR}/${year}`, name: `F${normalizedNumber}.pdf`}
    ];
  } else if (type == FILE_TYPES.INVOICE_ACCOUNTANCY_EXPORT) {
    return [
      { path: ACCOUNTANCY_EXPORT_DIR, name: 'ACT.csv' },
      { path: ACCOUNTANCY_EXPORT_DIR, name: `${timestamp()}-ACT.csv` }
    ];
  } else if (type == FILE_TYPES.CUSTOMER_ACCOUNTANCY_EXPORT) {
    return [
      { path: ACCOUNTANCY_EXPORT_DIR, name: 'CSF.csv' },
      { path: ACCOUNTANCY_EXPORT_DIR, name: `${timestamp()}-CSF.csv` }
    ];
  } else {
    throw new Error(`Upload location not yet implemented for file <${fileUri}> with type '${type}'`);
  }
}

function timestamp(date = new Date()) {
  return date.toISOString()
    .substr(0, 'yyyy-MM-DDTHH:mm:ss'.length)
    .replaceAll(/[^0-9]/g, '');
}

async function getCaseIdentifier(caseId) {
  const result = await query(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX dct: <http://purl.org/dc/terms/>

    SELECT ?identifier
    WHERE { ?case mu:uuid ${sparqlEscapeString(caseId)} ; dct:identifier ?identifier . }
  `);

  return result.results.bindings[0]?.['identifier'].value;
}

async function getVisitReportInfo(fileUri) {
  const result = await querySudo(`
    PREFIX prov: <http://www.w3.org/ns/prov#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

    SELECT ?number ?year
    WHERE {
      ${sparqlEscapeUri(fileUri)} nie:dataSource/prov:wasDerivedFrom ?request .
      ?request dct:identifier ?number ;
        dct:issued ?date .
      BIND (YEAR(?date) as ?year)
    } LIMIT 1
  `);

  if (result.results.bindings.length) {
    const binding = result.results.bindings[0];
    return {
      number: binding['number'].value,
      year: binding['year'].value
    };
  } else {
    return {};
  }
}

async function getInvoiceInfo(fileUri) {
  const result = await querySudo(`
    PREFIX prov: <http://www.w3.org/ns/prov#>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    PREFIX p2poInvoice: <https://purl.org/p2p-o/invoice#>

    SELECT ?number ?year
    WHERE {
      ${sparqlEscapeUri(fileUri)} nie:dataSource/prov:wasDerivedFrom ?invoice .
      ?invoice p2poInvoice:invoiceNumber ?number ;
        p2poInvoice:dateOfIssue ?date .
      BIND (YEAR(?date) as ?year)
    } LIMIT 1
  `);

  if (result.results.bindings.length) {
    const binding = result.results.bindings[0];
    return {
      number: binding['number'].value,
      year: binding['year'].value
    };
  } else {
    return {};
  }
}

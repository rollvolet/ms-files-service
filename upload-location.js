import { query, sparqlEscapeString, sparqlEscapeUri } from 'mu';
import { querySudo } from '@lblod/mu-auth-sudo';

const VISIT_REPORT_DIR = process.env.VISIT_REPORT_DIR || '/crm-development/visit-reports';
const INTERVENTION_REPORT_DIR = process.env.INTERVENTION_REPORT_DIR || '/crm-development/intervention-reports';
const OFFER_DIR = process.env.OFFER_DIR || '/crm-development/offers';
const ORDER_DIR = process.env.ORDER_DIR || '/crm-development/orders';
const DELIVERY_NOTE_DIR = process.env.DELIVERY_NOTE_DIR || '/crm-development/delivery-notes';
const INVOICE_DIR = process.env.INVOICE_DIR || '/crm-development/invoices';
const PRODUCTION_TICKET_TEMPLATES_DIR = process.env.PRODUCTION_TICKET_TEMPLATES_DIR || '/crm-development/production-ticket-templates';
const PRODUCTION_TICKETS_DIR = process.env.PRODUCTION_TICKETS_DIR || '/crm-development/production-tickets';
const CASE_ATTACHMENT_DIR = process.env.CASE_ATTACHMENT_DIR || '/crm-development/attachments';
const ACCOUNTANCY_EXPORT_DIR = process.env.ACCOUNTANCY_EXPORT_DIR || '/crm-development/winbooks';

export const FILE_TYPES = {
  VISIT_REPORT: 'http://data.rollvolet.be/concepts/f5b9c371-a0ed-4476-90a1-3e73d5d4f09e',
  INTERVENTION_REPORT: 'http://data.rollvolet.be/concepts/5d7f3d76-b78e-4481-ba66-89879ea1b3eb',
  OFFER: 'http://data.rollvolet.be/concepts/51577f19-9d90-4abf-a0d2-187770f76fc9',
  ORDER: 'http://data.rollvolet.be/concepts/6d080a6b-41f1-45f1-9698-7cbd3c846494',
  DELIVERY_NOTE: 'http://data.rollvolet.be/concepts/dcf1aa80-6b1b-4423-8ce1-4df7ffe85684',
  DEPOSIT_INVOICE: 'http://data.rollvolet.be/concepts/5c93373f-30f3-454c-8835-15140ff6d1d4',
  INVOICE: 'http://data.rollvolet.be/concepts/3abc9905-29b9-47f2-a77d-e94a4025f8c3',
  CASE_ATTACHMENT: 'http://data.rollvolet.be/concepts/44e7a6a6-b0e6-4a9c-ae4c-1f66275f730d',
  PRODUCTION_TICKET_TEMPLATE: 'http://data.rollvolet.be/concepts/0b49fae8-3546-4211-9c1e-64f359993c82',
  PRODUCTION_TICKET: 'http://data.rollvolet.be/concepts/bcc644a0-eff3-4cf6-a60a-9d4e490d47f0',
  INVOICE_ACCOUNTANCY_EXPORT: 'http://data.rollvolet.be/concepts/6fbc15d2-11c0-4868-8b11-d15b8f1a3802',
  CUSTOMER_ACCOUNTANCY_EXPORT: 'http://data.rollvolet.be/concepts/7afecda8-f128-4043-a69c-a68cbaaedac5'
};

/**
 * Returns one or more locations a file with a given type should be uploaded to.
 * The location depends on the type of the file.
 * Multiple locations may be returned. The first one is considered to be the 'main' location.
 * Other locations are just copies of the same file and will not be tracked in the triplestore.
*/
export async function getUploadLocations(type, opts) {
  let optionsFn, pathFn = () => {};

  if (type == FILE_TYPES.CASE_ATTACHMENT) {
    optionsFn = async (opts) => {
      const result = await query(`
        PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
        PREFIX dct: <http://purl.org/dc/terms/>

        SELECT ?identifier
        WHERE { ?case mu:uuid ${sparqlEscapeString(opts.case.id)} ; dct:identifier ?identifier . }
      `);

      return { identifier: result.results.bindings[0]?.['identifier'].value, fileName: opts.fileName };
    };
    pathFn = (opts) => [ { path: `${CASE_ATTACHMENT_DIR}/${opts.identifier}`, name: opts.fileName } ];
  }

  else if (type == FILE_TYPES.VISIT_REPORT) {
    optionsFn = (opts) => {
      return queryOne(`
        PREFIX dct: <http://purl.org/dc/terms/>
        PREFIX schema: <http://schema.org/>

        SELECT ?number ?year
        WHERE {
          ${sparqlEscapeUri(opts.resource)} schema:identifier ?number ;
            dct:issued ?date .
          BIND (YEAR(?date) as ?year)
        } LIMIT 1
      `);
    };
    pathFn = (opts) => [ { path: `${VISIT_REPORT_DIR}/${opts.year}`, name: `AD${opts.number}.pdf`} ];
  }

  else if (type == FILE_TYPES.INTERVENTION_REPORT) {
    optionsFn = (opts) => {
      return queryOne(`
        PREFIX dct: <http://purl.org/dc/terms/>
        PREFIX schema: <http://schema.org/>

        SELECT ?number ?year
        WHERE {
          ${sparqlEscapeUri(opts.resource)} schema:identifier ?number ;
            dct:issued ?date .
          BIND (YEAR(?date) as ?year)
        } LIMIT 1
      `);
    };
    pathFn = (opts) => [ { path: `${INTERVENTION_REPORT_DIR}/${opts.year}`, name: `IR${opts.number}.pdf`} ];
  }

  else if (type == FILE_TYPES.OFFER) {
    optionsFn = (opts) => {
      return queryOne(`
        PREFIX dct: <http://purl.org/dc/terms/>
        PREFIX schema: <http://schema.org/>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>
        PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

        SELECT ?number ?year ?version
        WHERE {
          ?case ext:offer ${sparqlEscapeUri(opts.resource)} ;
            ext:request ?request .
          ${sparqlEscapeUri(opts.resource)} dct:issued ?date ;
            owl:versionInfo ?version .
          ?request schema:identifier ?number .
          BIND (YEAR(?date) as ?year)
        } LIMIT 1
      `);
    };
    pathFn = (opts) => [ { path: `${OFFER_DIR}/${opts.year}`, name: `AD${opts.number}_${opts.version}.pdf`} ];
  }

  else if (type == FILE_TYPES.ORDER) {
    optionsFn = (opts) => {
      return queryOne(`
        PREFIX dct: <http://purl.org/dc/terms/>
        PREFIX schema: <http://schema.org/>
        PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

        SELECT ?number ?year
        WHERE {
          ?case ext:order ${sparqlEscapeUri(opts.resource)} ;
            ext:request ?request .
          ${sparqlEscapeUri(opts.resource)} dct:issued ?date .
          ?request schema:identifier ?number .
          BIND (YEAR(?date) as ?year)
        } LIMIT 1
      `);
    };
    pathFn = (opts) => [ { path: `${ORDER_DIR}/${opts.year}`, name: `AD${opts.number}.pdf`} ];
  }

  else if (type == FILE_TYPES.DELIVERY_NOTE) {
    optionsFn = (opts) => {
      return queryOne(`
        PREFIX dct: <http://purl.org/dc/terms/>
        PREFIX schema: <http://schema.org/>
        PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

        SELECT ?number ?year
        WHERE {
          ?case ext:order ${sparqlEscapeUri(opts.resource)} ;
            ext:request ?request .
          ${sparqlEscapeUri(opts.resource)} dct:issued ?date .
          ?request schema:identifier ?number .
          BIND (YEAR(?date) as ?year)
        } LIMIT 1
      `);
    };
    pathFn = (opts) => [ { path: `${DELIVERY_NOTE_DIR}/${opts.year}`, name: `AD${opts.number}.pdf`} ];
  }

  else if (type == FILE_TYPES.INVOICE || type == FILE_TYPES.DEPOSIT_INVOICE) {
    optionsFn = async (opts) => {
      const result = await queryOne(`
        PREFIX p2poInvoice: <https://purl.org/p2p-o/invoice#>

        SELECT ?number ?year
        WHERE {
          ${sparqlEscapeUri(opts.resource)} p2poInvoice:invoiceNumber ?number ;
            p2poInvoice:dateOfIssue ?date .
          BIND (YEAR(?date) as ?year)
        } LIMIT 1
      `);
      result['number'] = `${result['number']}`.padStart(7, 0); // normalize invoice number
      return result;
    };
    pathFn = (opts) => [ { path: `${INVOICE_DIR}/${opts.year}`, name: `F${opts.number}.pdf`} ];
  }

  else if (type == FILE_TYPES.PRODUCTION_TICKET) {
    optionsFn = async (opts) => {
      let caseStatement;
      if (opts.resource) {
        caseStatement = `${sparqlEscapeUri(opts.resource)} `;
      } else {
        caseStatement = `?case mu:uuid ${sparqlEscapeString(opts.case.id)} ; `;
      }
      const result = await queryOne(`
        PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
        PREFIX dct: <http://purl.org/dc/terms/>
        PREFIX schema: <http://schema.org/>
        PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
        PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>

        SELECT ?number ?year ?customerName
        WHERE {
          ${caseStatement} ext:request ?request ;
            ext:order ?order ;
            schema:customer ?customer .
          ?request schema:identifier ?number .
          ?order dct:issued ?date .
          OPTIONAL { ?customer vcard:hasFamilyName ?customerName . }
          BIND (YEAR(?date) as ?year)
        } LIMIT 1
      `);
      result['customerName'] = result['customerName'] ? noNewLines(result['customerName']) : '';
      return result;
    };
    pathFn = (opts) => [ { path: `${PRODUCTION_TICKETS_DIR}/${opts.year}`, name: `AD${opts.number}_${opts.customerName}.pdf`} ];
  }

  else if (type == FILE_TYPES.PRODUCTION_TICKET_TEMPLATE) {
    optionsFn = (opts) => {
      return queryOne(`
        PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
        PREFIX dct: <http://purl.org/dc/terms/>
        PREFIX schema: <http://schema.org/>
        PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

        SELECT ?number ?year
        WHERE {
          ${sparqlEscapeUri(opts.resource)} ext:request ?request ; ext:order ?order .
          ?request schema:identifier ?number .
          ?order dct:issued ?date .
          BIND (YEAR(?date) as ?year)
        } LIMIT 1
      `);
    };
    pathFn = (opts) => [ { path: `${PRODUCTION_TICKET_TEMPLATES_DIR}/${opts.year}`, name: `AD${opts.number}.pdf`} ];
  }

  else if (type == FILE_TYPES.INVOICE_ACCOUNTANCY_EXPORT) {
    pathFn = () => [
      { path: ACCOUNTANCY_EXPORT_DIR, name: 'ACT.csv' },
      { path: ACCOUNTANCY_EXPORT_DIR, name: `${timestamp()}-ACT.csv` }
    ];
  }

  else if (type == FILE_TYPES.CUSTOMER_ACCOUNTANCY_EXPORT) {
    pathFn = () => [
      { path: ACCOUNTANCY_EXPORT_DIR, name: 'CSF.csv' },
      { path: ACCOUNTANCY_EXPORT_DIR, name: `${timestamp()}-CSF.csv` }
    ];
  }

  else {
    throw new Error(`Upload location not yet implemented for file type '${type}'`);
  }

  const pathOpts = await optionsFn(opts);
  return pathFn(pathOpts);
}

export async function getUploadLocationsForFile(fileUri) {
  const { type, resource } = await getFileType(fileUri);
  return getUploadLocations(type, { resource });
}

function timestamp(date = new Date()) {
  return date.toISOString()
    .substr(0, 'yyyy-MM-DDTHH:mm:ss'.length)
    .replaceAll(/[^0-9]/g, '');
}

async function queryOne(q) {
  const { results } = await querySudo(q);
  if (results.bindings.length) {
    const binding = results.bindings[0];
    const result = {};
    for (let key of Object.keys(binding)) {
      result[key] = binding[key]?.value;
    }
    return result;
  } else {
    return null;
  }
}

async function getFileType(fileUri) {
  return queryOne(`
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

    SELECT ?type ?resource
    WHERE {
      GRAPH ?g {
        ${sparqlEscapeUri(fileUri)} a nfo:FileDataObject ;
          nie:dataSource ?virtualFile .
        ?virtualFile dct:type ?type .
        OPTIONAL { ?virtualFile prov:wasDerivedFrom ?resource . }
      }
    } LIMIT 1
  `);
}

function noNewLines(name) {
  return name.replace(/\r|\n|\r\n|\t|\|/g, '');
}

import { query, update, sparqlEscapeUri, sparqlEscapeString, sparqlEscapeDateTime, sparqlEscapeInt, uuid } from 'mu';
import { sleep } from './utils';

const BASE_URI = 'http://data.rollvolet.be';

async function insertUploadedFile(file, { case: _case, source, type }) {
  const predicate = _case ? '^dossier:Dossier.bestaatUit' : 'prov:wasDerivedFrom';
  const resourceId = [_case, source].find((r) => r?.id).id;

  const fileId = uuid();
  const fileUri = `${BASE_URI}/files/${fileId}`;

  const remoteFileId = uuid();
  const remoteFileUri = `${BASE_URI}/files/${remoteFileId}`;

  const msIdentifier = file.id;
  const extension = file.name.substr(file.name.lastIndexOf('.') + 1);

  const typeStatement = type ? `dct:type ${sparqlEscapeUri(type)} ;` : '';

  await update(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    PREFIX dbpedia: <http://dbpedia.org/ontology/>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>
    PREFIX prov: <http://www.w3.org/ns/prov#>

    INSERT {
      ${sparqlEscapeUri(fileUri)} a nfo:FileDataObject ;
        mu:uuid ${sparqlEscapeString(fileId)} ;
        nfo:fileName ${sparqlEscapeString(file.name)} ;
        dct:format ${sparqlEscapeString(file.format)} ;
        nfo:fileSize ${sparqlEscapeInt(file.size)} ;
        dbpedia:fileExtension ${sparqlEscapeString(extension)} ;
        nfo:fileCreated ${sparqlEscapeDateTime(file.created)} ;
        ${typeStatement} ;
        ${predicate} ?resource .
      ${sparqlEscapeUri(remoteFileUri)} a nfo:RemoteDataObject ;
        mu:uuid ${sparqlEscapeString(file.id)} ;
        nfo:fileName ${sparqlEscapeString(file.name)} ;
        dct:format ${sparqlEscapeString(file.format)} ;
        dct:identifier ${sparqlEscapeString(msIdentifier)} ;
        nfo:fileSize ${sparqlEscapeInt(file.size)} ;
        dbpedia:fileExtension ${sparqlEscapeString(extension)} ;
        nfo:fileCreated ${sparqlEscapeDateTime(file.created)} ;
        nfo:fileUrl ${sparqlEscapeUri(file.url)} ;
        nie:dataSource ${sparqlEscapeUri(fileUri)} .
    } WHERE {
      ?resource mu:uuid ${sparqlEscapeString(resourceId)} .
    }
  `);

  return {
    id: fileId,
    uri: fileUri,
    name: file.name,
    format: file.format,
    size: file.size,
    extension: file.extension,
    created: file.created
  };
}

async function getMsFileId(fileId) {
  const result = await query(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    PREFIX dct: <http://purl.org/dc/terms/>

    SELECT ?msFileId
    WHERE {
      ?file mu:uuid ${sparqlEscapeString(fileId)} .
      ?remoteFile nie:dataSource ?file ;
          dct:identifier ?msFileId .
    } LIMIT 1
  `);

  if (result.results.bindings.length) {
    return result.results.bindings[0]['msFileId'].value;
  } else {
    return null;
  }
}

async function deleteFile(fileId) {
  // Remove file as attachment from case (if relation exists)
  await update(`
    PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

    DELETE {
      ?case dossier:Dossier.bestaatUit ?file .
    } WHERE {
      ?case dossier:Dossier.bestaatUit ?file .
      ?file a nfo:FileDataObject ;
        mu:uuid ${sparqlEscapeString(fileId)} .
    }
  `);

  // Force cache clearing in mu-cl-resources by deleting only one property
  // without removing the rdf:type or mu:uuid.
  // That way mu-cl-resources generates correct clear keys for mu-cache.
  // TODO this query can be removed once the cache clearing issue is fixed in mu-cl-resources
  await update(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

    DELETE {
      ?file nfo:fileName ?name .
      ?remoteFile nfo:fileName ?remoteName .
    } WHERE {
      ?file a nfo:FileDataObject ;
        mu:uuid ${sparqlEscapeString(fileId)} ;
        nfo:fileName ?name .
      ?remoteFile a nfo:RemoteDataObject ;
        nie:dataSource ?file ;
        nfo:fileName ?remoteName .
    }
  `);
  await sleep(1000);

  // Remove virtual and remote file
  await update(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

    DELETE {
      ?file ?p ?o .
      ?remoteFile ?x ?y .
    } WHERE {
      ?file a nfo:FileDataObject ;
        mu:uuid ${sparqlEscapeString(fileId)} ;
        ?p ?o .
      ?remoteFile a nfo:RemoteDataObject ;
        nie:dataSource ?file ;
        ?x ?y .
    }
  `);
}

async function fetchInvoice(invoiceId) {
  const result = await query(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX p2poDocument: <https://purl.org/p2p-o/document#>
    PREFIX p2poInvoice: <https://purl.org/p2p-o/invoice#>

    SELECT ?invoice ?date ?number ?type
    WHERE {
      ?invoice a p2poDocument:E-Invoice, ?type ;
        mu:uuid ${sparqlEscapeString(invoiceId)} ;
        p2poInvoice:dateOfIssue ?date ;
        p2poInvoice:invoiceNumber ?number .
        FILTER (?type != p2poDocument:E-Invoice)
    } LIMIT 1
  `);

  if (result.results.bindings.length) {
    const binding = result.results.bindings[0];
    return {
      uri: binding['invoice'].value,
      id: invoiceId,
      date: new Date(Date.parse(binding['date'].value)),
      number: binding['number'].value,
      isDepositInvoice: binding['type'].value == 'https://purl.org/p2p-o/invoice#E-PrePaymentInvoice'
    };
  } else {
    return null;
  }
}

export {
  insertUploadedFile,
  getMsFileId,
  deleteFile,
  fetchInvoice
}

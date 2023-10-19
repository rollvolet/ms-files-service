import { query, update, sparqlEscapeUri, sparqlEscapeString, sparqlEscapeDateTime, sparqlEscapeInt, uuid } from 'mu';
import { querySudo, updateSudo } from '@lblod/mu-auth-sudo';
import { sleep } from './utils';

const BASE_URI = 'http://data.rollvolet.be';

const SESSIONS_GRAPH = process.env.SESSIONS_GRAPH || 'http://mu.semte.ch/graphs/sessions';
const USERS_GRAPH = process.env.USERS_GRAPH || 'http://mu.semte.ch/graphs/users';

async function insertUploadedFile(file, { case: _case, source, type }) {
  const resourceId = [_case, source].find((r) => r?.id).id;

  const fileId = uuid();
  const fileUri = `${BASE_URI}/files/${fileId}`;

  const remoteFileId = uuid();
  const remoteFileUri = `${BASE_URI}/files/${remoteFileId}`;

  const msIdentifier = file.id;
  const extension = file.name.substr(file.name.lastIndexOf('.') + 1);

  const typeStatement = type ? `dct:type ${sparqlEscapeUri(type)} ;` : '';
  const originStatement = _case
        ? `?resource dossier:Dossier.bestaatUit ${sparqlEscapeUri(fileUri)} .`
        : `${sparqlEscapeUri(fileUri)} prov:wasDerivedFrom ?resource .`;

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
        ${typeStatement}
        nfo:fileName ${sparqlEscapeString(file.name)} ;
        dct:format ${sparqlEscapeString(file.format)} ;
        nfo:fileSize ${sparqlEscapeInt(file.size)} ;
        dbpedia:fileExtension ${sparqlEscapeString(extension)} ;
        nfo:fileCreated ${sparqlEscapeDateTime(file.created)} .
        ${originStatement}
      ${sparqlEscapeUri(remoteFileUri)} a nfo:RemoteDataObject ;
        mu:uuid ${sparqlEscapeString(remoteFileId)} ;
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

async function moveUploadedFile(localFileUri, uploadedFile) {
  const remoteFileId = uuid();
  const remoteFileUri = `${BASE_URI}/files/${remoteFileId}`;

  const msIdentifier = uploadedFile.id;
  const extension = uploadedFile.name.substr(uploadedFile.name.lastIndexOf('.') + 1);

  await updateSudo(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    PREFIX dbpedia: <http://dbpedia.org/ontology/>
    PREFIX dct: <http://purl.org/dc/terms/>

    DELETE {
      GRAPH ?g {
        ${sparqlEscapeUri(localFileUri)} a nfo:FileDataObject ; ?p ?o .
        ?virtualFile nfo:fileName ?fileName .
      }
    } INSERT {
      GRAPH ?g {
        ?virtualFile nfo:fileName ${sparqlEscapeString(uploadedFile.name)} .
        ${sparqlEscapeUri(remoteFileUri)} a nfo:RemoteDataObject ;
          mu:uuid ${sparqlEscapeString(remoteFileId)} ;
          nfo:fileName ${sparqlEscapeString(uploadedFile.name)} ;
          dct:format ${sparqlEscapeString(uploadedFile.format)} ;
          dct:identifier ${sparqlEscapeString(msIdentifier)} ;
          nfo:fileSize ${sparqlEscapeInt(uploadedFile.size)} ;
          dbpedia:fileExtension ${sparqlEscapeString(extension)} ;
          nfo:fileCreated ${sparqlEscapeDateTime(uploadedFile.created)} ;
          nfo:fileUrl ${sparqlEscapeUri(uploadedFile.url)} ;
          nie:dataSource ?virtualFile .
      }
    } WHERE {
      GRAPH ?g {
        ${sparqlEscapeUri(localFileUri)} a nfo:FileDataObject ;
          nie:dataSource ?virtualFile ;
          ?p ?o .
        ?virtualFile a nfo:FileDataObject ;
          nfo:fileName ?fileName .
      }
    }
  `);
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

  return result.results.bindings[0]?.['msFileId'].value;
}

async function getFileId(msFileId) {
  const result = await query(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    PREFIX dct: <http://purl.org/dc/terms/>

    SELECT ?uuid
    WHERE {
      ?file mu:uuid ?uuid .
      ?remoteFile nie:dataSource ?file ;
          dct:identifier ${sparqlEscapeString(msFileId)} .
    } LIMIT 1
  `);

  return result.results.bindings[0]?.['uuid'].value;
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

async function getActiveSessionForFileCreator(fileUri) {
  const result = await querySudo(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX muSession: <http://mu.semte.ch/vocabularies/session/>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX oauth: <http://data.rollvolet.be/vocabularies/oauth-2.0/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>

    SELECT ?session
    WHERE {
      GRAPH ?g {
        ${sparqlEscapeUri(fileUri)} dct:creator ?user .
      }
      GRAPH ${sparqlEscapeUri(USERS_GRAPH)} {
        ?user foaf:account ?account .
      }
      GRAPH ${sparqlEscapeUri(SESSIONS_GRAPH)} {
        ?session muSession:account ?account .
        ?oauthSession oauth:authenticates ?session ;
                      oauth:tokenValue ?accessToken ;
                      oauth:expirationDate ?expiration .
        FILTER (?expiration >= ${sparqlEscapeDateTime(new Date())})
      }
    } LIMIT 1
  `);

  return result.results.bindings[0]?.['session']?.value;
}

export {
  SESSIONS_GRAPH,
  USERS_GRAPH,
  insertUploadedFile,
  moveUploadedFile,
  getFileId,
  getMsFileId,
  deleteFile,
  fetchInvoice,
  getActiveSessionForFileCreator
}

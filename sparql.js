import { query, update, sparqlEscapeUri, sparqlEscapeString, sparqlEscapeDateTime, sparqlEscapeInt, uuid } from 'mu';
import { sleep } from './utils';

const BASE_URI = 'http://data.rollvolet.be';

async function insertUploadedFile(file) {
  const fileId = uuid();
  const fileUri = `${BASE_URI}/files/${fileId}`;

  const remoteFileId = uuid();
  const remoteFileUri = `${BASE_URI}/files/${remoteFileId}`;

  const msIdentifier = file.id;
  const extension = file.name.substr(file.name.lastIndexOf('.') + 1);

  await update(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    PREFIX dbpedia: <http://dbpedia.org/ontology/>
    PREFIX dct: <http://purl.org/dc/terms/>

    INSERT DATA {
      ${sparqlEscapeUri(fileUri)} a nfo:FileDataObject ;
        mu:uuid ${sparqlEscapeString(fileId)} ;
        nfo:fileName ${sparqlEscapeString(file.name)} ;
        dct:format ${sparqlEscapeString(file.format)} ;
        nfo:fileSize ${sparqlEscapeInt(file.size)} ;
        dbpedia:fileExtension ${sparqlEscapeString(extension)} ;
        nfo:fileCreated ${sparqlEscapeDateTime(file.created)} .
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

async function linkAttachmentToCase(attachmentUri, caseId) {
  const caseUri = `${BASE_URI}/cases/${caseId}`;

  // TODO remove insertion of dossier:Dossier triples once all cases
  // from SQL are converted to triples
  await update(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>
    PREFIX dct: <http://purl.org/dc/terms/>

    INSERT DATA {
        ${sparqlEscapeUri(caseUri)} a dossier:Dossier ;
          mu:uuid ${sparqlEscapeString(caseId)} ;
          dct:identifier ${sparqlEscapeString(caseId)} .
    }
  `);

  await update(`
    PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>
    PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>

    INSERT DATA {
        ${sparqlEscapeUri(caseUri)} dossier:Dossier.bestaatUit ${sparqlEscapeUri(attachmentUri)} .
    }
  `);
}

export {
  insertUploadedFile,
  getMsFileId,
  deleteFile,
  linkAttachmentToCase
}

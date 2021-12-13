import { sparqlEscapeUri, sparqlEscapeString, sparqlEscapeDateTime, sparqlEscapeInt, uuid, update } from 'mu';

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

async function linkAttachmentToCase(attachmentUri, caseId) {
  const caseUri = `${BASE_URI}/cases/${caseId}`;

  // TODO remove insertion of dossier:Dossier triple once all cases are converted to triples
  await update(`
    PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>
    INSERT DATA {
        ${sparqlEscapeUri(caseUri)} a dossier:Dossier .
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
  linkAttachmentToCase
}

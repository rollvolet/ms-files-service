# MS files service

Microservice to upload/download files to Microsoft 365 Cloud using [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/api/overview?view=graph-rest-1.0) [on behalf of the user](https://docs.microsoft.com/en-us/graph/auth-v2-user).

## Getting started
### Adding the service to your stack
Add the following snippet to your `docker-compose.yml` to include the files service in your project.

```yml
files:
  image: rollvolet/ms-files-service
  environment:
    MS_DRIVE_ID: "my-microsoft-drive-id"
  volumes:
    - ./data/filedrop:/upload
```

Add rules to the `dispatcher.ex` to dispatch requests to the files service. E.g.

```elixir
  define_accept_types [
    json: [ "application/json", "application/vnd.api+json" ],
    html: [ "text/html", "application/xhtml+html" ],
    any: [ "*/*" ]
  ]

  define_layers [ :static, :services ]


  post "/cases/:id/attachments", %{ layer: :services, accept: %{ json: true } } do
    Proxy.forward conn, [], "http://ms-files/cases/" <> id <> "/attachments"
  end

  post "/cases/:id/production-tickets", %{ layer: :services, accept: %{ json: true } } do
    Proxy.forward conn, [], "http://ms-files/cases/" <> id <> "/production-tickets"
  end

  delete "/files/*path", %{ layer: :services, accept: %{ json: true } } do
    Proxy.forward conn, path, "http://ms-files/files/"
  end

  get "/files/:id/download", %{ layer: :services, accept: %{ any: true } } do
    Proxy.forward conn, [], "http://ms-files/files/" <> id <> "/download"
  end

  get "/downloads/*path", %{ layer: :services, accept: %{ any: true } } do
    Proxy.forward conn, path, "http://ms-files/downloads/"
  end

  delete "/downloads/*path", %{ layer: :services, accept: %{ any: true } } do
    Proxy.forward conn, path, "http://ms-files/downloads/"
  end
```

## Reference
### Configuration
The following enviroment variables can be set on the service:
- **MS_DRIVE_ID**: ID of the Microsoft drive to store files on (differs per environment)
- **FILE_DROP_SYNC_INTERVAL_MS**: Frequence in milliseconds to check for new files to be uploaded in the upload folder (default: `10000`, ie. 10 seconds)
- **USERS_GRAPH** : graph in which the person and account resources are stored (default: `http://mu.semte.ch/graphs/users`)
- **SESSIONS_GRAPH** : graph in which the session resources are stored. (default: `http://mu.semte.ch/graphs/sessions`)

The following base paths for file storage locations can be set via environments variables. The variable name is self explaining:
- `VISIT_REPORT_DIR`
- `INTERVENTION_REPORT_DIR`
- `OFFER_DIR`
- `ORDER_DIR`
- `DELIVERY_NOTE_DIR`
- `INVOICE_DIR`
- `PRODUCTION_TICKET_TEMPLATES_DIR`
- `PRODUCTION_TICKETS_DIR`
- `CASE_ATTACHMENT_DIR`
- `ACCOUNTANCY_EXPORT_DIR`


### Model
#### Ontologies and prefixes
The data model is based on the data model of the [mu-file-service](https://github.com/mu-semtech/file-service) but contains a few additions.

| Prefix  | URI                                                       |
|---------|-----------------------------------------------------------|
| nfo     | http://www.semanticdesktop.org/ontologies/2007/03/22/nfo# |
| nie     | http://www.semanticdesktop.org/ontologies/2007/01/19/nie# |
| dct     | http://purl.org/dc/terms/                                 |
| dbpedia | http://dbpedia.org/ontology/                              |
| dossier | https://data.vlaanderen.be/ns/dossier#                    |
| prov    | http://www.w3.org/ns/prov#                                |


#### Files
##### Description
The file service represents an uploaded file as 2 resources in the triplestore: a resource reflecting the (virtual) uploaded file (`nfo:FileDataObject`) and another resource reflecting the remote file (`nfo:RemoteDataObject`) stored in the O365 cloud.

##### Class
`nfo:FileDataObject`

##### Properties
| Name      | Predicate                     | Range             | Definition                          |
|-----------|-------------------------------|-------------------|-------------------------------------|
| name      | `nfo:fileName`                | `xsd:string`      | Name of the uploaded file           |
| format    | `dct:format`                  | `xsd:string`      | MIME-type of the file               |
| size      | `nfo:fileSize`                | `xsd:integer`     | Size of the file in bytes           |
| extension | `dbpedia:fileExtension`       | `xsd:string`      | Extension of the file               |
| created   | `nfo:fileCreated`             | `xsd:dateTime`    | Upload datetime                     |
| case      | `^dossier:Dossier.bestaatUit` | `dossier:Dossier` | Case this file is an attachment for |
| resource      | `prov:wasDerivedFrom` | `rdf:Resource` | Resource this file was deriverd from |

#### Remote files
##### Class
`nfo:RemoteDataObject`

##### Properties
| Name       | Predicate               | Range                | Definition                                        |
|------------|-------------------------|----------------------|---------------------------------------------------|
| name       | `nfo:fileName`          | `xsd:string`         | Name of the remote file                           |
| format     | `dct:format`            | `xsd:string`         | MIME-type of the file                             |
| size       | `nfo:fileSize`          | `xsd:integer`        | Size of the file in bytes                         |
| extension  | `dbpedia:fileExtension` | `xsd:string`         | Extension of the file                             |
| created    | `nfo:fileCreated`       | `xsd:dateTime`       | Upload datetime                                   |
| dataSource | `nie:dataSource`        | `nfo:FileDataObject` | (Virtual) uploaded file this file originates from |
| identifier | `dct:identifier`        | `xsd:string`         | Identifier of the file in the O365 cloud          |
| url        | `nfo:fileUrl`           | `rdf:Resource`       | URL of the remote file in the  O365 cloud         |

### Automatic file upload
The service can automatically upload files dropped in `/upload` in the background. At regular intervals the `/upload` folder is checked for new files. If a new file is found, it will be automatically uploaded to the 0365 drive. The upload location on the drive is determined based on the file type and additional information found in the triplestore. The file is uploaded on behalf of the user that created the file.

To support additional file types or modify the storage location of an existing file type one must adapt the logic found in `./upload-location.js`.

### API
#### POST /cases/:id/attachments
Uploads a new file as an attachment for the given case. Accepts a `multipart/form-data` with a `file` parameter containing the uploaded file.
##### Response
- `201 Created` in case the file is uploaded successfully
- `400 Bad Request` if the file request parameter is missing

```javascript
{
  "data": {
    "id": "2a7cef50-5db4-11ec-a1af-83cfbf653860",
    "type": "files",
    "attributes": {
      "uri": "http://data.rollvolet.be/files/2a7cef50-5db4-11ec-a1af-83cfbf653860",
      "name": "my-test-file.html",
      "format": "text/html",
      "size": 13107,
      "created": "2021-12-15T14:34:52.000Z"
    }
  }
}
```

#### POST /cases/:id/production-tickets
Uploads a new file as a production ticket for the given case. Accepts a `multipart/form-data` with a `file` parameter containing the uploaded file.
##### Response
- `201 Created` in case the file is uploaded successfully
- `400 Bad Request` if the file request parameter is missing

```javascript
{
  "data": {
    "id": "2a7cef50-5db4-11ec-a1af-83cfbf653860",
    "type": "files",
    "attributes": {
      "uri": "http://data.rollvolet.be/files/2a7cef50-5db4-11ec-a1af-83cfbf653860",
      "name": "my-test-file.html",
      "format": "text/html",
      "size": 13107,
      "created": "2021-12-15T14:34:52.000Z"
    }
  }
}
```

#### GET /files/:id/download
Get a temporary URL to download the file with the given id.
##### Response
- `204 No Content` with the temporary download URL in the `Location` response header on success
- `404 Not Found` in case a file with the given id cannot be found

#### DELETE /files/:id
Deletes the file with the given id from the O365 drive
##### Response
- `204 No Content` if the file is deleted successfully
- `404 Not Found` in case a file with the given id cannot be found


#### GET /downloads?resource=<resource>&type=<type>
Get a temporary URL to download the file with the given type related to a given resource. Based on the type and the related resource the file location can be determined.
##### Response
- `204 No Content` with the temporary download URL in the `Location` response header on success
- `404 Not Found` in case a file cannot be found

#### DELETE /downloads?resource=<resource>&type=<type>
Deletes the file with with the given type related to a given resource. Based on the type and the related resource the file location can be determined.
##### Response
- `204 No Content` if the file is deleted successfully

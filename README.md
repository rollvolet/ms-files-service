# MS files service

Microservice to upload/download files to Microsoft 365 Cloud using [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/api/overview?view=graph-rest-1.0) [on behalf of the user](https://docs.microsoft.com/en-us/graph/auth-v2-user).

## Getting started
### Adding the service to your stack
Add the following snippet to your `docker-compose.yml` to include the files service in your project.

```
files:
  image: rollvolet/ms-files-service
```

Add rules to the `dispatcher.ex` to dispatch requests to the files service. E.g.

```
  match "/files/*path", %{ accept: %{ json: true } } do
    Proxy.forward conn, path, "http://ms-files/files/"
  end
```

## Reference
### Configuration
TODO

### API
TODO

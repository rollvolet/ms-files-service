import { sparqlEscapeUri } from 'mu';
import { querySudo } from '@lblod/mu-auth-sudo';
import fetch, { Headers } from 'node-fetch';

const GRAPH_API = process.env.GRAPH_API || 'https://graph.microsoft.com/v1.0/';
const SESSIONS_GRAPH = process.env.SESSIONS_GRAPH || 'http://mu.semte.ch/graphs/sessions';

export default class GraphApiClient {
  constructor(sessionUri) {
    this.sessionUri = sessionUri;
  }

  /**
   * Get the access token for a given session from the triplestore.
   * Returns null if none can be found.
   */
  async getAccessToken() {
    const queryResult = await querySudo(`
      PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
      PREFIX oauth: <http://data.rollvolet.be/vocabularies/oauth-2.0/>
      SELECT ?accessToken
      WHERE {
        GRAPH <${SESSIONS_GRAPH}> {
          ?oauthSession oauth:authenticates ${sparqlEscapeUri(this.sessionUri)} ;
                        oauth:tokenValue ?accessToken .
        }
      }`);

    if (queryResult.results.bindings.length) {
      return queryResult.results.bindings[0]['accessToken'].value;
    } else {
      throw new Error('No access token available for session');
    }
  };

  async me() {
    const accessToken = await this.getAccessToken();
    const response = await fetch(`${GRAPH_API}/me`, {
      headers: this.getAuthorizationHeader(accessToken)
    });
    const json = await response.json();

    console.log('Retrieved my profile');
    console.log(json);
  }

  /**
   * @private
  */
  getAuthorizationHeader(accessToken) {
    return new Headers({
      Authorization: `Bearer ${accessToken}`
    });
  }
}

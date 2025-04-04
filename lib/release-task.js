import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import { renameTriples } from './same-as';
import { renameMinisterMapping } from './minister-mapping';
import { createEmailOnFailure } from './email';

import { MU_APPLICATION_GRAPH, RELEASE_TASK_STATUSES, HOST_DOMAIN } from '../config';

class ReleaseTask {
  constructor({ uri, source, created, status }) {
    /** Uri of the release task */
    this.uri = uri;

    /**
     * Uri of the temporary graph where the data should be retrieved from
    */
    this.source = source;

    /**
     * Datetime as Data object when the task was created in the triplestore
    */
    this.created = created;

    /**
     * Current status of the release task as stored in the triplestore
    */
    this.status = status;

  }

  /**
   * Persists the given status as task status in the triple store
   *
   * @param status {string} URI of the task status
   * @private
  */
  async persistStatus(status) {
    this.status = status;

    await update(`
      PREFIX adms: <http://www.w3.org/ns/adms#>

      DELETE WHERE {
        GRAPH <${MU_APPLICATION_GRAPH}> {
          <${this.uri}> adms:status ?status .
        }
      }
    `);

    await update(`
      PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
      PREFIX adms: <http://www.w3.org/ns/adms#>

      INSERT {
        GRAPH <${MU_APPLICATION_GRAPH}> {
          <${this.uri}> adms:status <${this.status}> .
        }
      } WHERE {
        GRAPH <${MU_APPLICATION_GRAPH}> {
          <${this.uri}> a ext:ReleaseTask .
        }
      }
    `);
  }

  /**
   * Execute the sync task
   *
   * @public
  */
  async execute() {
    try {
      await this.persistStatus(RELEASE_TASK_STATUSES.PREPARING_RELEASE);
      await renameMinisterMapping(this.source);
      await renameTriples(this.source);
      await this.persistStatus(RELEASE_TASK_STATUSES.READY_FOR_RELEASE);
      const nextTask = await getNextReleaseTask();
      if (nextTask) {
        nextTask.execute();
      }
    } catch (e) {
      await this.closeWithFailure();
      console.log(`Something went wrong while processing the release task.`);
      console.log(e);
      await createEmailOnFailure(
        "A release task has fully failed in themis-same-as",
        `environment: ${HOST_DOMAIN}\t\nDetail of error: ${e?.message || "no details available"}\t\n
        This error will fully block this and future releases and needs to be fixed manually!`
      );
    }
  }

  /**
  * Close the sync task with a failure status
  *
  * @public
 */
  async closeWithFailure() {
    await this.persistStatus(RELEASE_TASK_STATUSES.FAILED);
  }
}

/**
 * Get the URI of the currently running release task.
 * Null if no task is running.
 *
 * @public
*/
async function getRunningReleaseTask() {
  const result = await query(`
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX adms: <http://www.w3.org/ns/adms#>
    PREFIX dct: <http://purl.org/dc/terms/>

    SELECT ?s WHERE {
      GRAPH <${MU_APPLICATION_GRAPH}> {
        ?s a ext:ReleaseTask ;
         dct:created ?created ;
         adms:status <${RELEASE_TASK_STATUSES.PREPARING_RELEASE}> .
      }
    } ORDER BY ?created LIMIT 1
  `);

  return result.results.bindings.length ? { uri: result.results.bindings[0]['s'] } : null;
}

/**
 * Get the URI of a failed release task.
 * Null if no task has failed.
 *
 * @public
*/
async function getFailedReleaseTask() {
  const result = await query(`
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX adms: <http://www.w3.org/ns/adms#>
    PREFIX dct: <http://purl.org/dc/terms/>

    SELECT ?s WHERE {
      GRAPH <${MU_APPLICATION_GRAPH}> {
        ?s a ext:ReleaseTask ;
         dct:created ?created ;
         adms:status <${RELEASE_TASK_STATUSES.FAILED}> .
      }
    } ORDER BY ?created LIMIT 1
  `);

  return result.results.bindings.length ? { uri: result.results.bindings[0]['s'] } : null;
}

/**
 * Get the next release task with the earliest creation date that has not started yet
 *
 * @public
*/
async function getNextReleaseTask() {
  const result = await query(`
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX adms: <http://www.w3.org/ns/adms#>
    PREFIX dct: <http://purl.org/dc/terms/>

    SELECT ?s ?source ?created WHERE {
      GRAPH <${MU_APPLICATION_GRAPH}> {
        ?s a ext:ReleaseTask ;
          adms:status <${RELEASE_TASK_STATUSES.NOT_STARTED}> ;
          dct:source ?source ;
          dct:created ?created .
        FILTER NOT EXISTS { ?t a ext:ReleaseTask ; adms:status <${RELEASE_TASK_STATUSES.FAILED}> . }
      }
    } ORDER BY ?created LIMIT 1
  `);

  if (result.results.bindings.length) {
    const b = result.results.bindings[0];

    return new ReleaseTask({
      uri: b['s'].value,
      source: b['source'].value,
      status: RELEASE_TASK_STATUSES.NOT_STARTED,
      created: new Date(Date.parse(b['created'].value))
    });
  } else {
    return null;
  }
}

export default ReleaseTask;
export {
  getNextReleaseTask,
  getFailedReleaseTask,
  getRunningReleaseTask,
};

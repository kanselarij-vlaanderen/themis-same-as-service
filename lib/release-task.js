import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import { renameTriples } from './same-as';
import { renameMinisterMapping } from './minister-mapping';

import { MU_APPLICATION_GRAPH } from '../config';

const TASK_NOT_STARTED_STATUS = 'http://kanselarij.vo.data.gift/release-task-statuses/not-started';
const TASK_PREPARING_STATUS = 'http://kanselarij.vo.data.gift/release-task-statuses/preparing-release';
const TASK_READY_STATUS = 'http://kanselarij.vo.data.gift/release-task-statuses/ready-for-release';
const TASK_FAILED_STATUS = 'http://kanselarij.vo.data.gift/release-task-statuses/failed';

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
      await this.persistStatus(TASK_PREPARING_STATUS);
      await renameMinisterMapping(this.source);
      await renameTriples(this.source);
      await this.persistStatus(TASK_READY_STATUS);
      const nextTask = await getNextReleaseTask();
      if (nextTask) {
        nextTask.execute();
      }
    } catch (e) {
      await this.closeWithFailure();
      console.log(`Something went wrong while processing the release task.`);
      console.log(e);
    }
  }

  /**
  * Close the sync task with a failure status
  *
  * @public
 */
  async closeWithFailure() {
    await this.persistStatus(TASK_FAILED_STATUS);
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
         adms:status <${TASK_PREPARING_STATUS}> .
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
          adms:status <${TASK_NOT_STARTED_STATUS}> ;
          dct:source ?source ;
          dct:created ?created .
        FILTER NOT EXISTS { ?t a ext:ReleaseTask ; adms:status <${TASK_FAILED_STATUS}> . }
      }
    } ORDER BY ?created LIMIT 1
  `);

  if (result.results.bindings.length) {
    const b = result.results.bindings[0];

    return new ReleaseTask({
      uri: b['s'].value,
      source: b['source'].value,
      status: TASK_NOT_STARTED_STATUS,
      created: new Date(Date.parse(b['created'].value))
    });
  } else {
    return null;
  }
}

export default ReleaseTask;
export {
  getNextReleaseTask,
  getRunningReleaseTask,
  TASK_NOT_STARTED_STATUS
};

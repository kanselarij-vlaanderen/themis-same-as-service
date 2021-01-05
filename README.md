# themis-same-as-service

Service preparing and cleaning up the data provided by [themis-publication-consumer](http://github.com/kanselarij-vlaanderen/themis-publication-consumer). After the data processing by the themis-same-as-service the data is ready to be released by [dcat-dataset-publication-service](http://github.com/kanselarij-vlaanderen/dcat-dataset-publication-service).


## Tutorials
### Add the service to a stack
Add the service to your `docker-compose.yml`:

```
  themis-same-as:
    image: kanselarij/themis-same-as
```

Next, make the service listen for new conversion tasks. Assuming a delta-notifier is already available in the stack, add the following rules to the delta-notifier's configuration in `./config/delta/rules`.

```javascript
export default [
  {
    match: {
      predicate: {
        type: 'uri',
        value: 'http://www.w3.org/ns/adms#status'
      },
      object: {
        type: 'uri',
        value: 'http://kanselarij.vo.data.gift/release-task-statuses/not-started'
      }
    },
    callback: {
      method: 'POST',
      url: 'http://themis-same-as/delta'
    },
    options: {
      resourceFormat: 'v0.0.1',
      gracePeriod: 250,
      ignoreFromSelf: true
    }
  }
];
```

## Reference
### Configuration

The following environment variables can be optionally configured:

* `SELECT_BATCH_SIZE (default: 1000)`: amount of triples to select in one SPARQL query

### Model
#### Used prefixes
| Prefix | URI                                                       |
|--------|-----------------------------------------------------------|
| dct    | http://purl.org/dc/terms/                                 |
| adms   | http://www.w3.org/ns/adms#                                |
| ext    | http://mu.semte.ch/vocabularies/ext                       |


#### Release task
##### Class
`ext:ReleaseTask`
##### Properties
| Name    | Predicate     | Range           | Definition                                                                                                        |
|---------|---------------|-----------------|-------------------------------------------------------------------------------------------------------------------|
| status  | `adms:status` | `rdfs:Resource` | Status of the release task, initially set to `<http://kanselarij.vo.data.gift/release-task-statuses/not-started>` |
| created | `dct:created` | `xsd:dateTime`  | Datetime of creation of the task                                                                                  |
| source  | `dct:source`  | `rdfs:Resource` | URI of the graph containing the data to be released                                                               |

#### Release task statuses
The status of the release task will be updated to reflect the progress of the task. The following statuses are known:
* http://kanselarij.vo.data.gift/release-task-statuses/not-started
* http://kanselarij.vo.data.gift/release-task-statuses/preparing-release
* http://kanselarij.vo.data.gift/release-task-statuses/ready-for-release
* http://kanselarij.vo.data.gift/release-task-statuses/releasing
* http://kanselarij.vo.data.gift/release-task-statuses/success
* http://kanselarij.vo.data.gift/release-task-statuses/failed

### Data flow
The service is triggered when a release task is prepared having status `<http://kanselarij.vo.data.gift/release-task-statuses/not-started>`. Execution of a task consists of creating a new Themis URI for all non whitelisted URI domains and replace the URI in the temporary graph linked to the release task.

The white listed domains are:
* http://themis.vlaanderen.be
* http://data.vlaanderen.be
* https://data.vlaanderen.be
* http://doris.vlaanderen.be
* http://mu.semte.ch/vocabularies
* http://nieuwsberichten.vonet.be
* http://purl.org
* http://vocab.deri.ie
* http://www.semanticdesktop.org
* http://www.w3.org
* http://xmlns.com
* share://

If an error occurs during the processing, subsequent release tasks are blocked.

On successful processing, the status of the `ext:ReleaseTask` is updated to `ready-for-release`.

The service makes a core assumption that must be respected at all times: maximum 1 release task is running at any moment in time

### API
```
POST /delta
```
Endpoint that receives delta's from the delta-notifier and prepares the data linked to the release task for the actual release. When the data is prepared successfully the release task will have status `ready for release`.
The endpoint is triggered externally whenever a new release task is created and is not supposed to be triggered manually.

import { app, errorHandler } from 'mu';
import { getRunningReleaseTask, getNextReleaseTask, TASK_NOT_STARTED_STATUS } from './lib/release-task';
import flatten from 'lodash.flatten';
import bodyParser from 'body-parser';

// parse application/json
app.use(bodyParser.json());

app.post('/delta', async function (req, res, next) {
  const isRunning = await getRunningReleaseTask();

  if (!isRunning) {
    const delta = req.body;
    const inserts = flatten(delta.map(changeSet => changeSet.inserts));
    const statusTriples = inserts.filter((t) => {
      return t.predicate.value == 'http://www.w3.org/ns/adms#status'
        && t.object.value == TASK_NOT_STARTED_STATUS;
    });

    if (statusTriples.length) {
      console.log(`Found ${statusTriples.length} release tasks.`);
      const task = await getNextReleaseTask();
      if (task) {
        console.log(`Starting same-as check`);
        task.execute(); // errors are handled inside task.execute()
        return res.status(202).end();
      } else {
        console.log(`No scheduled release task found.`);
        return res.status(200).end();
      }
    } else {
      console.log(`No triples found in the delta message.`);
      res.status(200).end();
    }
  } else {
    console.log('No release task found in delta message.');
    res.end('No release task found in delta message.');
  }
});



app.use(errorHandler);
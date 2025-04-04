import { app, errorHandler } from 'mu';
import { getRunningReleaseTask, getNextReleaseTask, getFailedReleaseTask } from './lib/release-task';
import { RELEASE_TASK_STATUSES } from './config';
import flatten from 'lodash.flatten';
import bodyParser from 'body-parser';

// parse application/json
app.use(bodyParser.json());

// check if any release task is already waiting when starting the service
async function init() {
  const task = await getNextReleaseTask();
  if (task) {
    console.log('Starting same-as check on start-up');
    task.execute(); // errors are handled inside task.execute()
  } else {
    const failedTask = await getFailedReleaseTask();
    if (failedTask) {
      console.error('A failed task was found on start-up, no deltas will be processed. Resolve manually');
      return;
    }
    console.log('No scheduled release task found on start-up. Waiting for new deltas.');
  }
}

init();

app.post('/delta', async function (req, res, next) {
  try {
    const isRunning = await getRunningReleaseTask();
    if (!isRunning) {
      const delta = req.body;
      const inserts = flatten(delta.map(changeSet => changeSet.inserts));
      const statusTriples = inserts.filter((t) => {
        return t.predicate.value == 'http://www.w3.org/ns/adms#status'
          && t.object.value == RELEASE_TASK_STATUSES.NOT_STARTED;
      });
  
      if (statusTriples.length) {
        console.log(`Found ${statusTriples.length} release tasks.`);
        const task = await getNextReleaseTask();
        if (task) {
          console.log('Starting same-as check');
          task.execute(); // errors are handled inside task.execute()
          return res.status(202).end();
        } else {
          // delta was found no talk is scheduled? 
          console.log('No scheduled release task found.');
          console.log('The releases could be blocked by a failed task, remove the failed task to continue');
          return res.status(200).end();
        }
      } else {
        console.log('No triples found in the delta message.');
        return res.status(200).end();
      }
    } else {
      console.log('There is already a release task running. Task from delta message will be executed later.');
      return res.end('There is already a release task running..');
    }
  } catch (error) {
    console.log('The processing of the delta message has failed.');
    console.trace(error);
    return res.status(500).end();
  }
});

app.use(errorHandler);
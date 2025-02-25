const MU_APPLICATION_GRAPH = 'http://mu.semte.ch/graphs/publication-tasks';
const SAME_AS_GRAPH = 'http://mu.semte.ch/graphs/same-as';
const PUBLIC_GRAPH = 'http://mu.semte.ch/graphs/public';
const SELECT_BATCH_SIZE = parseInt(process.env.SELECT_BATCH_SIZE) || 1000;
const RENAME_DOMAIN = process.env.RENAME_DOMAIN || 'http://themis.vlaanderen.be/id/resource/';
const HOST_DOMAIN = process.env.HOST_DOMAIN || 'https://themis.vlaanderen.be';
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS ?? 'noreply@kaleidos.vlaanderen.be';
const EMAIL_TO_ADDRESS_ON_FAILURE = process.env.EMAIL_TO_ADDRESS_ON_FAILURE ?? '';

// constants
const RELEASE_TASK_STATUSES = {
  NOT_STARTED: 'http://kanselarij.vo.data.gift/release-task-statuses/not-started',
  PREPARING_RELEASE: 'http://kanselarij.vo.data.gift/release-task-statuses/preparing-release',
  READY_FOR_RELEASE: 'http://kanselarij.vo.data.gift/release-task-statuses/ready-for-release',
  // RELEASING: 'http://kanselarij.vo.data.gift/release-task-statuses/releasing', // unused in this service
  SUCCESS: 'http://kanselarij.vo.data.gift/release-task-statuses/success',
  FAILED: 'http://kanselarij.vo.data.gift/release-task-statuses/failed'
}

const RESOURCE_BASE_URI  = 'http://themis.vlaanderen.be';
const EMAIL_GRAPH_URI = "http://mu.semte.ch/graphs/system/email";
const EMAIL_OUTBOX_URI = "http://themis.vlaanderen.be/id/mail-folders/d9a415a4-b5e5-41d0-80ee-3f85d69e318c";

export {
  MU_APPLICATION_GRAPH,
  SAME_AS_GRAPH,
  PUBLIC_GRAPH,
  SELECT_BATCH_SIZE,
  RENAME_DOMAIN,
  HOST_DOMAIN,
  EMAIL_FROM_ADDRESS,
  EMAIL_TO_ADDRESS_ON_FAILURE,
  RELEASE_TASK_STATUSES,
  RESOURCE_BASE_URI,
  EMAIL_GRAPH_URI,
  EMAIL_OUTBOX_URI
};

const MU_APPLICATION_GRAPH = 'http://mu.semte.ch/graphs/publication-tasks';
const SAME_AS_GRAPH = 'http://mu.semte.ch/graphs/same-as';
const SELECT_BATCH_SIZE = parseInt(process.env.SELECT_BATCH_SIZE) || 1000;
const RENAME_DOMAIN = process.env.RENAME_DOMAIN || 'http://themis.vlaanderen.be/id/resource/';

export {
  MU_APPLICATION_GRAPH,
  SAME_AS_GRAPH,
  SELECT_BATCH_SIZE,
  RENAME_DOMAIN
};

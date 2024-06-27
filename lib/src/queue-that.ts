import {
  createLocalStorageAdapter,
  LocalStorageAdapter
} from './local-storage-adapter';
import {
  createGlobalVariableAdapter,
  GlobalVariableAdapter
} from './global-variable-adapter';

const DEFAULT_QUEUE_LABEL = 'Queue That';
const BACKOFF_TIME = 1000;
const QUEUE_GROUP_TIME = 100;
const PROCESS_TIMEOUT = 2000;
const DEFAULT_BATCH_SIZE = 20;
const ACTIVE_QUEUE_TIMEOUT = 2500;

export interface QueueThatOptions {
  process: (batch: any[], callback: (err?: Error) => void) => void;
  batchSize?: number;
  label?: string;
  trim?: <T>(input: T) => T;
  queueGroupTime?: number;
  backoffTime?: number;
  processTimeout?: number;
  activeQueueTimeout?: number;
}

export function createQueueThat(options: QueueThatOptions) {
  if (!options.process) {
    throw new Error('A process function is required');
  }
  options.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  options.label = options.label ?? DEFAULT_QUEUE_LABEL;
  options.trim = options.trim ?? identity;
  options.queueGroupTime = options.queueGroupTime ?? QUEUE_GROUP_TIME;
  options.backoffTime = options.backoffTime ?? BACKOFF_TIME;
  options.processTimeout = options.processTimeout ?? PROCESS_TIMEOUT;
  options.activeQueueTimeout =
    options.activeQueueTimeout ?? ACTIVE_QUEUE_TIMEOUT;

  if (options.processTimeout > options.activeQueueTimeout) {
    throw new Error(
      'Active queue timeout must be greater than process timeout'
    );
  }

  let checkTimer: ReturnType<typeof setTimeout>,
    processTimer: ReturnType<typeof setTimeout>,
    newQueueTimer: ReturnType<typeof setTimeout>,
    flushTimer: ReturnType<typeof setTimeout>;
  let processingTasks = false;
  let checkScheduled = false;
  const queueId = Math.random() + now();
  let flushScheduled = false;
  let destroyed = false;

  let storageAdapter: LocalStorageAdapter | GlobalVariableAdapter =
    createLocalStorageAdapter(options.label);
  if (!storageAdapter.works()) {
    storageAdapter = createGlobalVariableAdapter(options.label);
  }

  const queueThatInstance: any = {
    storageAdapter,
    options,
    flush,
    destroy: () => {
      destroyed = true;
      clearTimeout(checkTimer);
      clearTimeout(processTimer);
      clearTimeout(newQueueTimer);
      clearTimeout(flushTimer);
    },
    flushQueueCache: storageAdapter.flush,
    queueThat
  };

  console.info('Initialized with queue ID ' + queueId);

  checkQueueDebounce();
  newQueueTimer = setTimeout(checkQueue, options.activeQueueTimeout);

  return queueThatInstance;

  function queueThat(item: any) {
    const queue = storageAdapter.getQueue();
    queue.push(item);
    //@Changes
    if (options.trim) {
      storageAdapter.setQueue(options.trim(queue));
    }

    console.info('Item queued');

    checkQueueDebounce();
  }

  function flush() {
    if (flushScheduled) return;

    checkScheduled = true;
    flushScheduled = true;
    clearTimeout(checkTimer);

    flushTimer = setTimeout(() => {
      checkQueue();
      checkScheduled = false;
      flushScheduled = false;
    });
  }

  function checkQueueDebounce() {
    if (checkScheduled) return;
    checkScheduled = true;
    checkTimer = setTimeout(() => {
      checkQueue();
      checkScheduled = false;
    }, /*@Changes*/ options.queueGroupTime ?? QUEUE_GROUP_TIME);
  }

  function checkQueue() {
    console.info('Checking queue');

    if (processingTasks) return;

    const backoffTime = storageAdapter.getBackoffTime() - now();
    if (backoffTime > 0) {
      setTimeout(checkQueue, backoffTime);
      return;
    }

    const lastActiveQueue = getLastActiveQueueInfo();
    if (lastActiveQueue.active && lastActiveQueue.id !== queueId) return;
    if (lastActiveQueue.id !== queueId)
      console.info('Switching active queue to ' + queueId);

    storageAdapter.setActiveQueue(queueId);

    const batch = storageAdapter
      .getQueue()
      .slice(0, /*@Changes*/ options.batchSize ?? DEFAULT_BATCH_SIZE);
    if (batch.length === 0) {
      return;
    }

    console.info('Processing queue batch of ' + batch.length + ' items');
    //@Changes
    /*batch.containsRepeatedItems = storageAdapter.getQueueProcessing();
        if (batch.containsRepeatedItems) console.info('Batch contains repeated items');
        else console.info('Batch does not contain repeated items');*/

    const itemsProcessing = batch.length;
    let timeout = false;
    let finished = false;

    options.process(batch, err => {
      if (timeout || destroyed) return;
      processingTasks = false;
      finished = true;
      if (err) {
        processError(err);
        checkQueueDebounce();
        return;
      }

      storageAdapter.setErrorCount(0);
      const queue = rest(storageAdapter.getQueue(), itemsProcessing);
      storageAdapter.setQueue(queue);

      storageAdapter.setQueueProcessing(false);
      storageAdapter.flush();

      console.log('Queue processed, ' + queue.length + ' remaining items');

      checkQueueDebounce();
    });

    processTimer = setTimeout(() => {
      if (finished || destroyed) return;
      timeout = true;
      processingTasks = false;
      processError(new Error('Task timeout'));
    }, /*@Changes*/ options.processTimeout ?? PROCESS_TIMEOUT);

    processingTasks = true;
    storageAdapter.setQueueProcessing(true);
    storageAdapter.flush();
  }

  function processError(err: Error) {
    console.error('Process error, backing off (' + err.message + ')');
    const errorCount = storageAdapter.getErrorCount() + 1;
    storageAdapter.setErrorCount(errorCount);
    storageAdapter.setBackoffTime(
      now() + options.backoffTime * Math.pow(2, errorCount - 1)
    );
    console.warn(
      'Backoff time ' + (storageAdapter.getBackoffTime() - now()) + 'ms'
    );
  }

  function getLastActiveQueueInfo(): { id: number | null; active: boolean } {
    const activeInstance = storageAdapter.getActiveQueue();
    console.log('activeInstance: ', activeInstance);
    if (activeInstance === null) {
      return { id: null, active: false };
    }
    const timeSinceActive = now() - activeInstance.ts;
    return {
      id: activeInstance.id,
      active: timeSinceActive < options.activeQueueTimeout
    };
  }

  function now() {
    return new Date().getTime();
  }

  function deactivateOnUnload(queueId: number) {
    if (window.addEventListener) {
      window.addEventListener('beforeunload', deactivate);
    } else if (window.attachEvent) {
      window.attachEvent('onbeforeunload', deactivate);
    }

    function deactivate() {
      const activeQueue = storageAdapter.getActiveQueue();
      if (activeQueue && activeQueue.id === queueId) {
        //@Changes
        queueThatInstance.destroy();
        //queueThat.destroy();
        storageAdapter.clearActiveQueue();
        console.info('Deactivated on page unload');
      }
    }
  }
}

function identity<T>(input: T): T {
  return input;
}

function rest<T>(array: T[], n: number): T[] {
  return array.slice(n);
}

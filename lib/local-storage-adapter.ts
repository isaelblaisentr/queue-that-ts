const QUEUE_KEY = '* - Queue';
const ACTIVE_QUEUE_KEY = '* - Active Queue';
const BACKOFF_TIME_KEY = '* - Backoff Time';
const ERROR_COUNT_KEY = '* - Error Count';
const QUEUE_PROCESSING_KEY = '* - Queue Processing';

interface QueueItem {
    id: number;
    ts: number;
}

export interface LocalStorageAdapter {
    getQueue: () => QueueItem[];
    setQueue: (queue: QueueItem[]) => void;
    getErrorCount: () => number;
    getBackoffTime: () => number;
    setErrorCount: (n: number) => void;
    setBackoffTime: (n: number) => void;
    getActiveQueue: () => QueueItem | undefined;
    setActiveQueue: (id: number) => void;
    clearActiveQueue: () => void;
    getQueueProcessing: () => boolean;
    setQueueProcessing: (isProcessing: boolean) => void;
    save: (key: string, data: string) => void;
    load: (key: string) => string | undefined;
    works: () => boolean;
    reset: () => void;
    remove: (key: string) => void;
    type: string;
    flush: () => void;
}

export function createLocalStorageAdapter(queueName: string): LocalStorageAdapter {
    const queueKey = QUEUE_KEY.replace('*', queueName);
    const activeQueueKey = ACTIVE_QUEUE_KEY.replace('*', queueName);
    const backoffTimeKey = BACKOFF_TIME_KEY.replace('*', queueName);
    const errorCountKey = ERROR_COUNT_KEY.replace('*', queueName);
    const queueProcessingKey = QUEUE_PROCESSING_KEY.replace('*', queueName);

    let dirtyCache = true;
    let setPending = false;
    let queueCache: QueueItem[] = [];

    const adapter: LocalStorageAdapter = {
        getQueue,
        setQueue,
        getErrorCount,
        getBackoffTime,
        setErrorCount,
        setBackoffTime,
        getActiveQueue,
        setActiveQueue,
        clearActiveQueue,
        getQueueProcessing,
        setQueueProcessing,
        save,
        load,
        works,
        reset,
        remove,
        type: 'localStorage',
        flush
    };

    return adapter;

    function flush() {
        dirtyCache = true;
        if (setPending) {
            adapter.save(queueKey, JSON.stringify(queueCache));
            setPending = false;
        }
    }

    function getQueue(): QueueItem[] {
        if (dirtyCache) {
            queueCache = JSON.parse(adapter.load(queueKey) || '[]');
            dirtyCache = false;
            setTimeout(flush, 0);
        }
        return queueCache;
    }

    function setQueue(queue: QueueItem[]) {
        queueCache = queue;
        dirtyCache = false;
        setPending = true;
        setTimeout(flush, 0);
    }

    function getErrorCount(): number {
        const count = adapter.load(errorCountKey);
        return count === undefined ? 0 : Number(count);
    }

    function getBackoffTime(): number {
        const time = adapter.load(backoffTimeKey);
        return time === undefined ? 0 : Number(time);
    }

    function setErrorCount(n: number) {
        adapter.save(errorCountKey, n.toString());
    }

    function setBackoffTime(n: number) {
        adapter.save(backoffTimeKey, n.toString());
    }

    function getActiveQueue(): QueueItem | undefined {
        const activeQueue = adapter.load(activeQueueKey);
        return activeQueue === undefined ? undefined : JSON.parse(activeQueue);
    }

    function setActiveQueue(id: number) {
        adapter.save(activeQueueKey, JSON.stringify({ id, ts: now() }));
    }

    function clearActiveQueue() {
        adapter.remove(activeQueueKey);
    }

    function getQueueProcessing(): boolean {
        return Boolean(Number(adapter.load(queueProcessingKey)));
    }

    function setQueueProcessing(isProcessing: boolean) {
        adapter.save(queueProcessingKey, Number(isProcessing).toString());
    }

    function works(): boolean {
        let works = false;
        try {
            adapter.save('queue-that-works', 'anything');
            works = adapter.load('queue-that-works') === 'anything';
            adapter.remove('queue-that-works');
        } catch (e) {}
        return works;
    }

    function reset() {
        adapter.remove(activeQueueKey);
        adapter.remove(backoffTimeKey);
        adapter.remove(errorCountKey);
        adapter.remove(queueKey);
        adapter.remove(queueProcessingKey);
    }
}

function save(key: string, data: string) {
    window.localStorage.setItem(key, data);
}

function load(key: string): string | undefined {
    return window.localStorage.getItem(key);
}

function remove(key: string) {
    window.localStorage.removeItem(key);
}

function now(): number {
    return (new Date()).getTime();
}
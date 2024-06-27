import { createLocalStorageAdapter, LocalStorageAdapter } from './local-storage-adapter';

declare global {
    interface Window {
        __queueThat__?: { [key: string]: string };
        attachEvent(event: string, listener: EventListener): boolean;
        detachEvent(event: string, listener: EventListener): void;
    }
}

export interface GlobalVariableAdapter extends LocalStorageAdapter {
    save: (key: string, data: string) => void;
    load: (key: string) => string | null;
    remove: (key: string) => void;
    //type: string;
}

export function createGlobalVariableAdapter(queueName: string): GlobalVariableAdapter {
    window.__queueThat__ = window.__queueThat__ || {};

    const localStorageAdapter = createLocalStorageAdapter(queueName) as GlobalVariableAdapter;
    localStorageAdapter.save = save;
    localStorageAdapter.load = load;
    localStorageAdapter.remove = remove;
    localStorageAdapter.type = 'globalVariable';

    return localStorageAdapter;

    function save(key: string, data: string) {
        if (window.__queueThat__) {
            window.__queueThat__[key] = String(data);
        }
    }

    function load(key: string): string | null {
        if (window.__queueThat__) {
            return window.__queueThat__[key];
        }
        return null;
    }

    function remove(key: string) {
        if (window.__queueThat__) {
            delete window.__queueThat__[key];
        }
    }
}

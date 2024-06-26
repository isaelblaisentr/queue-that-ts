# queue-that-ts

## Description
A queue managed in localStorage for async tasks that may run immediately before page unload. Queue That is built primarily to queue Http requests for reporting.

> **Note**
> I left some comments named `@Changes` where I quickly applied fixes for typescript to compile.

### Usage

```javascript
const queue = createQueueThat({
    process(batch, error) {
        fetch('http://endpoint/api/event', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(batch[0]),
        }).then((res) => {
            error(false);
        });
        /*
        .catch(error => {
           // do something with error
           error(true); // or error object.
        })
         */
    },
    batchSize: 1,
});

const queueEvent = (eventObject: any) => {
    queue.queueThat({
        type: 'EVENT_NAME',
        meta: {
            ...eventObject
        },
    });
}
```

### Credits

This is a converted javascript to typescript version of initial repository: https://github.com/QubitProducts/queue-that




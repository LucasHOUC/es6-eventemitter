import immunity from 'immunity';

export class EventEmitter {
    constructor() {
        this.events = {};
        this.maxListeners = this.constructor.defaultMaxListeners;

        this.paused = false;
        this.emitQueue = [];
    }

    getMaxListeners() {
        return this.maxListeners;
    }

    setMaxListeners(value) {
        this.maxListeners = value;

        return this;
    }

    eventNames() {
        return Object.getOwnPropertyNames(this.events);
    }

    listenerCount(eventName) {
        const available = this.events.hasOwnProperty(eventName);

        if (!available) {
            return 0;
        }

        const eventListeners = this.events[eventName];

        return eventListeners.on.length + eventListeners.once.length;
    }

    listeners(eventName, exists) {
        const available = this.events.hasOwnProperty(eventName);

        if (exists) {
            return available;
        }

        if (!available) {
            return [];
        }

        const eventListeners = this.events[eventName];

        return immunity.mergeArrays(
            eventListeners.on.map((item) => item.listener),
            eventListeners.once.map((item) => item.listener)
        );
    }

    emit(eventName, ...args) {
        if (!this.events.hasOwnProperty(eventName)) {
            return false;
        }

        if (this.paused) {
            this.emitQueue = immunity.appendToArray(
                this.emitQueue,
                { async: false, eventName: eventName, params: args }
            );

            return true;
        }

        const eventListeners = this.events[eventName],
            listenerCallDelegate = (item) => item.listener.apply(item.context, args);

        this.events = immunity.appendToObject(this.events, {
            [eventName]: {
                on: eventListeners.on,
                once: []
            }
        });

        eventListeners.on.forEach(listenerCallDelegate);
        eventListeners.once.forEach(listenerCallDelegate);

        return true;
    }

    async emitAsync(eventName, ...args) {
        if (!this.events.hasOwnProperty(eventName)) {
            return false;
        }

        if (this.paused) {
            this.emitQueue = immunity.appendToArray(
                this.emitQueue,
                { async: true, eventName: eventName, params: args }
            );

            return true;
        }

        const eventListeners = this.events[eventName],
            listenerCallDelegate = (item) => new Promise((resolve, reject) => {
                try {
                    resolve(item.listener.apply(item.context, args));
                }
                catch (err) {
                    reject(err);
                }
            });

        this.events = immunity.appendToObject(this.events, {
            [eventName]: {
                on: eventListeners.on,
                once: []
            }
        });

        const result = immunity.mergeArrays(
            eventListeners.on.map(listenerCallDelegate),
            eventListeners.once.map(listenerCallDelegate)
        );

        await Promise.all(result);

        return true;
    }

    on(eventName, listener, context, prepend) {
        if (eventName in this.events) {
            const eventListeners = this.events[eventName];

            this.events = immunity.appendToObject(this.events, {
                [eventName]: {
                    on: ((prepend) ? immunity.prependToArray : immunity.appendToArray)(
                        eventListeners.on,
                        {
                            listener: listener,
                            context: context
                        }
                    ),
                    once: eventListeners.once
                }
            });
        }
        else {
            this.events = immunity.appendToObject(this.events, {
                [eventName]: {
                    on: [
                        {
                            listener: listener,
                            context: context
                        }
                    ],
                    once: []
                }
            });
        }

        // this.emit('newListener', eventName, listener);

        return this;
    }

    once(eventName, listener, context, prepend) {
        if (eventName in this.events) {
            const eventListeners = this.events[eventName];

            this.events = immunity.appendToObject(this.events, {
                [eventName]: {
                    on: eventListeners.on,
                    once: ((prepend) ? immunity.prependToArray : immunity.appendToArray)(
                        eventListeners.once,
                        {
                            listener: listener,
                            context: context
                        }
                    )
                }
            });
        }
        else {
            this.events = immunity.appendToObject(this.events, {
                [eventName]: {
                    on: [],
                    once: [
                        {
                            listener: listener,
                            context: context
                        }
                    ]
                }
            });
        }

        // this.emit('newListener', eventName, listener);

        return this;
    }

    off(eventName, listener) {
        const listenerRemoveFilter = (item) => item.listener !== listener;

        if (eventName in this.events) {
            const eventListeners = this.events[eventName];

            this.events = immunity.appendToObject(this.events, {
                [eventName]: {
                    on: eventListeners.on.filter(listenerRemoveFilter),
                    once: eventListeners.once.filter(listenerRemoveFilter)
                }
            });
        }

        // this.emit('removeListener', eventName, listener);

        return this;
    }

    addListener(eventName, listener, context) {
        return this.on(eventName, listener, context, false);
    }

    prependListener(eventName, listener, context) {
        return this.on(eventName, listener, context, true);
    }

    prependOnceListener(eventName, listener, context) {
        return this.once(eventName, listener, context, true);
    }

    removeListener(eventName, listener) {
        return this.off(eventName, listener);
    }

    removeAllListeners(eventName) {
        if (eventName === undefined) {
            this.events = {};

            return;
        }

        this.events = immunity.removeKeyFromObject(this.events, eventName);
    }

    pause() {
        this.paused = true;
    }

    resume() {
        if (!this.paused) {
            return;
        }

        this.paused = false;

        for (const item of this.emitQueue) {
            if (item.async) {
                this.emitAsync(item.eventName, ...item.params);
            }
            else {
                this.emit(item.eventName, ...item.params);
            }
        }

        this.emitQueue = [];
    }
}

EventEmitter.defaultMaxListeners = 10;

export default EventEmitter;

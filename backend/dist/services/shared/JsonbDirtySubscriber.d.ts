import { EntitySubscriberInterface, LoadEvent } from 'typeorm';
export declare class JsonbDirtySubscriber implements EntitySubscriberInterface {
    afterLoad(entity: unknown, event?: LoadEvent<unknown>): void;
}
//# sourceMappingURL=JsonbDirtySubscriber.d.ts.map
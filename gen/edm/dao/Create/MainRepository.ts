import { query } from "sdk/db";
import { producer } from "sdk/messaging";
import { extensions } from "sdk/extensions";
import { dao as daoApi } from "sdk/db";

export interface MainEntity {
    readonly Id: number;
    Name?: string;
    Type?: string;
    Description?: string;
    Date?: string;
}

export interface MainCreateEntity {
    readonly Name?: string;
    readonly Type?: string;
    readonly Description?: string;
    readonly Date?: string;
}

export interface MainUpdateEntity extends MainCreateEntity {
    readonly Id: number;
}

export interface MainEntityOptions {
    $filter?: {
        equals?: {
            Id?: number | number[];
            Name?: string | string[];
            Type?: string | string[];
            Description?: string | string[];
            Date?: string | string[];
        };
        notEquals?: {
            Id?: number | number[];
            Name?: string | string[];
            Type?: string | string[];
            Description?: string | string[];
            Date?: string | string[];
        };
        contains?: {
            Id?: number;
            Name?: string;
            Type?: string;
            Description?: string;
            Date?: string;
        };
        greaterThan?: {
            Id?: number;
            Name?: string;
            Type?: string;
            Description?: string;
            Date?: string;
        };
        greaterThanOrEqual?: {
            Id?: number;
            Name?: string;
            Type?: string;
            Description?: string;
            Date?: string;
        };
        lessThan?: {
            Id?: number;
            Name?: string;
            Type?: string;
            Description?: string;
            Date?: string;
        };
        lessThanOrEqual?: {
            Id?: number;
            Name?: string;
            Type?: string;
            Description?: string;
            Date?: string;
        };
    },
    $select?: (keyof MainEntity)[],
    $sort?: string | (keyof MainEntity)[],
    $order?: 'asc' | 'desc',
    $offset?: number,
    $limit?: number,
}

interface MainEntityEvent {
    readonly operation: 'create' | 'update' | 'delete';
    readonly table: string;
    readonly entity: Partial<MainEntity>;
    readonly key: {
        name: string;
        column: string;
        value: number;
    }
}

interface MainUpdateEntityEvent extends MainEntityEvent {
    readonly previousEntity: MainEntity;
}

export class MainRepository {

    private static readonly DEFINITION = {
        table: "TYPE",
        properties: [
            {
                name: "Id",
                column: "TYPE_ID",
                type: "INTEGER",
                id: true,
                autoIncrement: true,
            },
            {
                name: "Name",
                column: "TYPE_NAME",
                type: "VARCHAR",
            },
            {
                name: "Type",
                column: "TYPE_TYPE",
                type: "VARCHAR",
            },
            {
                name: "Description",
                column: "TYPE_DESCRIPTION",
                type: "VARCHAR",
            },
            {
                name: "Date",
                column: "TYPE_DATE",
                type: "VARCHAR",
            }
        ]
    };

    private readonly dao;

    constructor(dataSource = "DefaultDB") {
        this.dao = daoApi.create(MainRepository.DEFINITION, null, dataSource);
    }

    public findAll(options?: MainEntityOptions): MainEntity[] {
        return this.dao.list(options);
    }

    public findById(id: number): MainEntity | undefined {
        const entity = this.dao.find(id);
        return entity ?? undefined;
    }

    public create(entity: MainCreateEntity): number {
        const id = this.dao.insert(entity);
        this.triggerEvent({
            operation: "create",
            table: "TYPE",
            entity: entity,
            key: {
                name: "Id",
                column: "TYPE_ID",
                value: id
            }
        });
        return id;
    }

    public update(entity: MainUpdateEntity): void {
        const previousEntity = this.findById(entity.Id);
        this.dao.update(entity);
        this.triggerEvent({
            operation: "update",
            table: "TYPE",
            entity: entity,
            previousEntity: previousEntity,
            key: {
                name: "Id",
                column: "TYPE_ID",
                value: entity.Id
            }
        });
    }

    public upsert(entity: MainCreateEntity | MainUpdateEntity): number {
        const id = (entity as MainUpdateEntity).Id;
        if (!id) {
            return this.create(entity);
        }

        const existingEntity = this.findById(id);
        if (existingEntity) {
            this.update(entity as MainUpdateEntity);
            return id;
        } else {
            return this.create(entity);
        }
    }

    public deleteById(id: number): void {
        const entity = this.dao.find(id);
        this.dao.remove(id);
        this.triggerEvent({
            operation: "delete",
            table: "TYPE",
            entity: entity,
            key: {
                name: "Id",
                column: "TYPE_ID",
                value: id
            }
        });
    }

    public count(options?: MainEntityOptions): number {
        return this.dao.count(options);
    }

    public customDataCount(): number {
        const resultSet = query.execute('SELECT COUNT(*) AS COUNT FROM "TYPE"');
        if (resultSet !== null && resultSet[0] !== null) {
            if (resultSet[0].COUNT !== undefined && resultSet[0].COUNT !== null) {
                return resultSet[0].COUNT;
            } else if (resultSet[0].count !== undefined && resultSet[0].count !== null) {
                return resultSet[0].count;
            }
        }
        return 0;
    }

    private async triggerEvent(data: MainEntityEvent | MainUpdateEntityEvent) {
        const triggerExtensions = await extensions.loadExtensionModules("test-Create-Main", ["trigger"]);
        triggerExtensions.forEach(triggerExtension => {
            try {
                triggerExtension.trigger(data);
            } catch (error) {
                console.error(error);
            }            
        });
        producer.topic("test-Create-Main").send(JSON.stringify(data));
    }
}

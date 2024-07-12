import { query } from "sdk/db";
import { producer } from "sdk/messaging";
import { extensions } from "sdk/extensions";
import { dao as daoApi } from "sdk/db";

export interface DteamEntity {
    readonly Id: number;
    Name?: string;
}

export interface DteamCreateEntity {
    readonly Name?: string;
}

export interface DteamUpdateEntity extends DteamCreateEntity {
    readonly Id: number;
}

export interface DteamEntityOptions {
    $filter?: {
        equals?: {
            Id?: number | number[];
            Name?: string | string[];
        };
        notEquals?: {
            Id?: number | number[];
            Name?: string | string[];
        };
        contains?: {
            Id?: number;
            Name?: string;
        };
        greaterThan?: {
            Id?: number;
            Name?: string;
        };
        greaterThanOrEqual?: {
            Id?: number;
            Name?: string;
        };
        lessThan?: {
            Id?: number;
            Name?: string;
        };
        lessThanOrEqual?: {
            Id?: number;
            Name?: string;
        };
    },
    $select?: (keyof DteamEntity)[],
    $sort?: string | (keyof DteamEntity)[],
    $order?: 'asc' | 'desc',
    $offset?: number,
    $limit?: number,
}

interface DteamEntityEvent {
    readonly operation: 'create' | 'update' | 'delete';
    readonly table: string;
    readonly entity: Partial<DteamEntity>;
    readonly key: {
        name: string;
        column: string;
        value: number;
    }
}

interface DteamUpdateEntityEvent extends DteamEntityEvent {
    readonly previousEntity: DteamEntity;
}

export class DteamRepository {

    private static readonly DEFINITION = {
        table: "TEAM",
        properties: [
            {
                name: "Id",
                column: "TEAM_ID",
                type: "INTEGER",
                id: true,
                autoIncrement: true,
            },
            {
                name: "Name",
                column: "TEAM_NAME",
                type: "VARCHAR",
            }
        ]
    };

    private readonly dao;

    constructor(dataSource = "DefaultDB") {
        this.dao = daoApi.create(DteamRepository.DEFINITION, null, dataSource);
    }

    public findAll(options?: DteamEntityOptions): DteamEntity[] {
        return this.dao.list(options);
    }

    public findById(id: number): DteamEntity | undefined {
        const entity = this.dao.find(id);
        return entity ?? undefined;
    }

    public create(entity: DteamCreateEntity): number {
        const id = this.dao.insert(entity);
        this.triggerEvent({
            operation: "create",
            table: "TEAM",
            entity: entity,
            key: {
                name: "Id",
                column: "TEAM_ID",
                value: id
            }
        });
        return id;
    }

    public update(entity: DteamUpdateEntity): void {
        const previousEntity = this.findById(entity.Id);
        this.dao.update(entity);
        this.triggerEvent({
            operation: "update",
            table: "TEAM",
            entity: entity,
            previousEntity: previousEntity,
            key: {
                name: "Id",
                column: "TEAM_ID",
                value: entity.Id
            }
        });
    }

    public upsert(entity: DteamCreateEntity | DteamUpdateEntity): number {
        const id = (entity as DteamUpdateEntity).Id;
        if (!id) {
            return this.create(entity);
        }

        const existingEntity = this.findById(id);
        if (existingEntity) {
            this.update(entity as DteamUpdateEntity);
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
            table: "TEAM",
            entity: entity,
            key: {
                name: "Id",
                column: "TEAM_ID",
                value: id
            }
        });
    }

    public count(options?: DteamEntityOptions): number {
        return this.dao.count(options);
    }

    public customDataCount(): number {
        const resultSet = query.execute('SELECT COUNT(*) AS COUNT FROM "TEAM"');
        if (resultSet !== null && resultSet[0] !== null) {
            if (resultSet[0].COUNT !== undefined && resultSet[0].COUNT !== null) {
                return resultSet[0].COUNT;
            } else if (resultSet[0].count !== undefined && resultSet[0].count !== null) {
                return resultSet[0].count;
            }
        }
        return 0;
    }

    private async triggerEvent(data: DteamEntityEvent | DteamUpdateEntityEvent) {
        const triggerExtensions = await extensions.loadExtensionModules("test-Teams-Dteam", ["trigger"]);
        triggerExtensions.forEach(triggerExtension => {
            try {
                triggerExtension.trigger(data);
            } catch (error) {
                console.error(error);
            }            
        });
        producer.topic("test-Teams-Dteam").send(JSON.stringify(data));
    }
}

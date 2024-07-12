import { query } from "sdk/db";
import { producer } from "sdk/messaging";
import { extensions } from "sdk/extensions";
import { dao as daoApi } from "sdk/db";

export interface UserEntity {
    readonly Id: number;
    Name?: string;
    Aboutme?: string;
    Description?: string;
    Dteam?: number;
}

export interface UserCreateEntity {
    readonly Name?: string;
    readonly Aboutme?: string;
    readonly Description?: string;
    readonly Dteam?: number;
}

export interface UserUpdateEntity extends UserCreateEntity {
    readonly Id: number;
}

export interface UserEntityOptions {
    $filter?: {
        equals?: {
            Id?: number | number[];
            Name?: string | string[];
            Aboutme?: string | string[];
            Description?: string | string[];
            Dteam?: number | number[];
        };
        notEquals?: {
            Id?: number | number[];
            Name?: string | string[];
            Aboutme?: string | string[];
            Description?: string | string[];
            Dteam?: number | number[];
        };
        contains?: {
            Id?: number;
            Name?: string;
            Aboutme?: string;
            Description?: string;
            Dteam?: number;
        };
        greaterThan?: {
            Id?: number;
            Name?: string;
            Aboutme?: string;
            Description?: string;
            Dteam?: number;
        };
        greaterThanOrEqual?: {
            Id?: number;
            Name?: string;
            Aboutme?: string;
            Description?: string;
            Dteam?: number;
        };
        lessThan?: {
            Id?: number;
            Name?: string;
            Aboutme?: string;
            Description?: string;
            Dteam?: number;
        };
        lessThanOrEqual?: {
            Id?: number;
            Name?: string;
            Aboutme?: string;
            Description?: string;
            Dteam?: number;
        };
    },
    $select?: (keyof UserEntity)[],
    $sort?: string | (keyof UserEntity)[],
    $order?: 'asc' | 'desc',
    $offset?: number,
    $limit?: number,
}

interface UserEntityEvent {
    readonly operation: 'create' | 'update' | 'delete';
    readonly table: string;
    readonly entity: Partial<UserEntity>;
    readonly key: {
        name: string;
        column: string;
        value: number;
    }
}

interface UserUpdateEntityEvent extends UserEntityEvent {
    readonly previousEntity: UserEntity;
}

export class UserRepository {

    private static readonly DEFINITION = {
        table: "USER",
        properties: [
            {
                name: "Id",
                column: "PLAYER_ID",
                type: "INTEGER",
                id: true,
                autoIncrement: true,
            },
            {
                name: "Name",
                column: "PLAYER_NAME",
                type: "VARCHAR",
            },
            {
                name: "Aboutme",
                column: "PLAYER_ABOUT_ME",
                type: "VARCHAR",
            },
            {
                name: "Description",
                column: "PLAYER_DESCRIPTION",
                type: "VARCHAR",
            },
            {
                name: "Dteam",
                column: "D_TEAM",
                type: "INTEGER",
            }
        ]
    };

    private readonly dao;

    constructor(dataSource = "DefaultDB") {
        this.dao = daoApi.create(UserRepository.DEFINITION, null, dataSource);
    }

    public findAll(options?: UserEntityOptions): UserEntity[] {
        return this.dao.list(options);
    }

    public findById(id: number): UserEntity | undefined {
        const entity = this.dao.find(id);
        return entity ?? undefined;
    }

    public create(entity: UserCreateEntity): number {
        const id = this.dao.insert(entity);
        this.triggerEvent({
            operation: "create",
            table: "USER",
            entity: entity,
            key: {
                name: "Id",
                column: "PLAYER_ID",
                value: id
            }
        });
        return id;
    }

    public update(entity: UserUpdateEntity): void {
        const previousEntity = this.findById(entity.Id);
        this.dao.update(entity);
        this.triggerEvent({
            operation: "update",
            table: "USER",
            entity: entity,
            previousEntity: previousEntity,
            key: {
                name: "Id",
                column: "PLAYER_ID",
                value: entity.Id
            }
        });
    }

    public upsert(entity: UserCreateEntity | UserUpdateEntity): number {
        const id = (entity as UserUpdateEntity).Id;
        if (!id) {
            return this.create(entity);
        }

        const existingEntity = this.findById(id);
        if (existingEntity) {
            this.update(entity as UserUpdateEntity);
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
            table: "USER",
            entity: entity,
            key: {
                name: "Id",
                column: "PLAYER_ID",
                value: id
            }
        });
    }

    public count(options?: UserEntityOptions): number {
        return this.dao.count(options);
    }

    public customDataCount(): number {
        const resultSet = query.execute('SELECT COUNT(*) AS COUNT FROM "USER"');
        if (resultSet !== null && resultSet[0] !== null) {
            if (resultSet[0].COUNT !== undefined && resultSet[0].COUNT !== null) {
                return resultSet[0].COUNT;
            } else if (resultSet[0].count !== undefined && resultSet[0].count !== null) {
                return resultSet[0].count;
            }
        }
        return 0;
    }

    private async triggerEvent(data: UserEntityEvent | UserUpdateEntityEvent) {
        const triggerExtensions = await extensions.loadExtensionModules("test-Register-User", ["trigger"]);
        triggerExtensions.forEach(triggerExtension => {
            try {
                triggerExtension.trigger(data);
            } catch (error) {
                console.error(error);
            }            
        });
        producer.topic("test-Register-User").send(JSON.stringify(data));
    }
}

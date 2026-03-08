import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

// 1. 定义消息属性接口
export interface MessageAttributes {
  id: number;
  senderId: number;
  channelId: number;
  content: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

// 2. 定义创建消息时的可选属性
export type MessageCreationAttributes = Optional<MessageAttributes, 'id' | 'createdAt' | 'updatedAt' | 'metadata'>;

// 3. 定义类并实现接口
export class Message extends Model<MessageAttributes, MessageCreationAttributes> implements MessageAttributes {
  public id!: number;
  public senderId!: number;
  public channelId!: number;
  public content!: Record<string, any>;
  public metadata?: Record<string, any>;

  // 时间戳字段
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * 静态初始化方法
   */
  public static initialize(sequelize: Sequelize) {
    this.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        senderId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'sender_id',
        },
        channelId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'channel_id',
        },
        content: {
          type: DataTypes.JSONB,
          allowNull: false,
        },
        metadata: {
          type: DataTypes.JSONB,
          allowNull: true,
          defaultValue: {},
        },
      },
      {
        sequelize,
        tableName: 'messages',
        underscored: true,
        timestamps: true,
        indexes: [
          { fields: ['sender_id'] },
          { fields: ['channel_id'] },
          { fields: ['created_at'] },
        ],
      }
    );
  }
}

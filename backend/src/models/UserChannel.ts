// 用户频道关联模型
// 实现用户与频道的多对多关系
// 一个用户可以加入多个频道
// 一个频道可以有多个用户
// 用于管理用户在频道中的角色和权限
import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

// 定义用户频道关联属性接口
// TypeScript类型定义，用于确保类型安全
// 定义了UserChannel模型的所有字段
// createdAt和updatedAt由Sequelize自动管理，无需手动设置
export interface UserChannelAttributes {
  id: number;                              // 关联ID，主键，自增
  userId: number;                           // 用户ID，外键，关联users表
  channelId: number;                        // 频道ID，外键，关联channels表
  role: 'admin' | 'moderator' | 'member';   // 用户在频道中的角色
  createdAt: Date;                         // 创建时间，自动添加
  updatedAt: Date;                         // 更新时间，自动添加
}

// 定义用户频道关联创建属性类型
// 使用Optional工具类型，将某些字段标记为可选
// 用于创建新关联时的类型检查
// 可选字段：id、createdAt、updatedAt
export type UserChannelCreationAttributes = Optional<UserChannelAttributes, 'id' | 'createdAt' | 'updatedAt' | 'role'>;

// 定义UserChannel类，继承自Sequelize的Model类
// 实现了UserChannelAttributes和UserChannelCreationAttributes接口
// 用于数据库操作，如UserChannel.create()、UserChannel.findAll()等
export class UserChannel extends Model<UserChannelAttributes, UserChannelCreationAttributes> implements UserChannelAttributes {
  // 字段声明
  // 使用!断言，表示这些字段会被Sequelize自动初始化
  public id!: number;
  public userId!: number;
  public channelId!: number;
  public role!: 'admin' | 'moderator' | 'member';
  public readonly createdAt!: Date;  // readonly表示这些字段由Sequelize管理，不可修改
  public readonly updatedAt!: Date;

  /**
   * 静态初始化方法
   * @param sequelize Sequelize实例
   * 用于初始化模型，定义字段、类型、验证规则等
   * 应用启动时调用，由models/index.ts中的初始化逻辑调用
   */
  public static initialize(sequelize: Sequelize) {
    // 调用Model.init()方法初始化模型
    // 第一个参数：字段定义
    // 第二个参数：模型配置
    this.init({
      id: {
        type: DataTypes.INTEGER,       // 字段类型：整数
        autoIncrement: true,          // 自增
        primaryKey: true,             // 主键
      },
      userId: {
        type: DataTypes.INTEGER,       // 字段类型：整数
        allowNull: false,             // 不允许为null
        references: {
          model: 'users',             // 关联的表名
          key: 'id',                  // 关联的字段名
        },
        onDelete: 'CASCADE',          // 当用户被删除时，自动删除关联
      },
      channelId: {
        type: DataTypes.INTEGER,       // 字段类型：整数
        allowNull: false,             // 不允许为null
        references: {
          model: 'channels',          // 关联的表名
          key: 'id',                  // 关联的字段名
        },
        onDelete: 'CASCADE',          // 当频道被删除时，自动删除关联
      },
      role: {
        type: DataTypes.ENUM('admin', 'moderator', 'member'),  // 枚举类型
        allowNull: false,             // 不允许为null
        defaultValue: 'member',       // 默认角色为普通成员
      },
    } as any, {
      sequelize,                     // Sequelize实例
      tableName: 'user_channels',    // 数据库表名
      modelName: 'UserChannel',      // 模型名称，Sequelize内部使用
      underscored: true,             // 启用下划线命名转换
      timestamps: true,              // 启用自动时间戳
      indexes: [                     // 索引配置，提高查询性能
        {
          fields: ['user_id'],       // 为userId字段创建索引，加速按用户查询
        },
        {
          fields: ['channel_id'],    // 为channelId字段创建索引，加速按频道查询
        },
        {
          fields: ['user_id', 'channel_id'],  // 联合索引，确保用户在同一频道中只能有一个角色
          unique: true,             // 唯一约束
        },
      ],
    });
  }
}

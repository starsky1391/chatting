// 频道模型
// 定义聊天应用中的频道数据结构
// 频道是用户发送和接收消息的主要场所
// 支持文本、语音和视频三种类型
import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

// 定义频道属性接口
// TypeScript类型定义，用于确保类型安全
// 定义了Channel模型的所有字段
// createdAt和updatedAt由Sequelize自动管理，无需手动设置
export interface ChannelAttributes {
  id: number;                              // 频道ID，主键，自增
  name: string;                           // 频道名称，唯一
  type: 'text' | 'voice' | 'video';       // 频道类型：文本、语音或视频
  description: string | null;             // 频道描述，可选
  createdAt: Date;                        // 创建时间，自动添加
  updatedAt: Date;                        // 更新时间，自动添加
}

// 定义频道创建属性类型
// 使用Optional工具类型，将某些字段标记为可选
// 用于创建新频道时的类型检查
// 可选字段：id、createdAt、updatedAt、description
export type ChannelCreationAttributes = Optional<ChannelAttributes, 'id' | 'createdAt' | 'updatedAt' | 'description'>;

// 定义Channel类，继承自Sequelize的Model类
// 实现了ChannelAttributes和ChannelCreationAttributes接口
// 用于数据库操作，如Channel.create()、Channel.findAll()等
export class Channel extends Model<ChannelAttributes, ChannelCreationAttributes> implements ChannelAttributes {
  // 字段声明
  // 使用!断言，表示这些字段会被Sequelize自动初始化
  public id!: number;
  public name!: string;
  public type!: 'text' | 'voice' | 'video';
  public description!: string | null;
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
      name: {
        type: DataTypes.STRING,        // 字段类型：字符串
        allowNull: false,             // 不允许为null
        unique: true,                 // 唯一约束，频道名称不能重复
        validate: {
          len: [1, 50],              // 长度验证：1-50个字符
        },
      },
      type: {
        type: DataTypes.ENUM('text', 'voice', 'video'),  // 枚举类型
        allowNull: false,             // 不允许为null
        defaultValue: 'text',         // 默认值为文本频道
      },
      description: {
        type: DataTypes.TEXT,         // 字段类型：文本，支持长文本
        allowNull: true,              // 允许为null，可选字段
      },
    } as any, {
      sequelize,                     // Sequelize实例
      tableName: 'channels',         // 数据库表名
      modelName: 'Channel',          // 模型名称，Sequelize内部使用
      underscored: true,             // 启用下划线命名转换
      timestamps: true,              // 启用自动时间戳
    });
  }
}
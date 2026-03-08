// 从sequelize库中导入必要的类型和类
// DataTypes: 定义字段类型
// Model: 基础模型类
// Sequelize: Sequelize实例类型
import { DataTypes, Model, Sequelize } from 'sequelize';

// 定义用户属性接口
// 这是TypeScript类型定义，用于确保类型安全
// 定义了User模型的所有字段
// 注意：createdAt和updatedAt是Sequelize自动添加的
// 这些字段会自动被Sequelize管理，无需手动设置
// 用于类型检查和代码提示
// 例如：在服务中使用User时，TypeScript会检查字段是否存在
// 这有助于避免拼写错误和类型错误
export interface UserAttributes {
  id: number;              // 用户ID，主键，自增
  username: string;         // 用户名，唯一
  email: string;            // 邮箱，唯一
  password: string;         // 密码，哈希存储
  avatar: string;           // 头像URL
  status: 'online' | 'idle' | 'do-not-disturb' | 'offline';  // 用户状态
  role: 'admin' | 'moderator' | 'member';  // 用户角色
  createdAt: Date;          // 创建时间，自动添加
  updatedAt: Date;          // 更新时间，自动添加
}

// 定义用户创建属性接口
// 用于创建新用户时的类型检查
// 标记了可选字段
// 例如：创建用户时可以不提供id、createdAt、updatedAt，因为这些会自动生成
// 注意：username、email、password是必填字段
export type UserCreationAttributes = {
  username: string;         // 必填字段
  email: string;            // 必填字段
  password: string;         // 必填字段
  avatar?: string;          // 可选字段，有默认值
  status?: 'online' | 'idle' | 'do-not-disturb' | 'offline';  // 可选字段，有默认值
  role?: 'admin' | 'moderator' | 'member';  // 可选字段，有默认值
};

// 定义User类，继承自Model
// 实现了UserAttributes和UserCreationAttributes接口
// 这是Sequelize的模型类，用于数据库操作
// 例如：User.create()、User.findAll()等方法
// 注意：这个类会被Sequelize自动实例化
// 不要手动new User()，应该使用User.create()或User.findByPk()
export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  // 字段声明
  // 这些字段会被Sequelize映射到数据库表中的列
  // 注意：使用!断言，表示这些字段会被Sequelize自动初始化
  public id!: number;
  public username!: string;
  public email!: string;
  public password!: string;
  public avatar!: string;
  public status!: 'online' | 'idle' | 'do-not-disturb' | 'offline';
  public role!: 'admin' | 'moderator' | 'member';
  public readonly createdAt!: Date;  // readonly表示这些字段是只读的，由Sequelize管理
  public readonly updatedAt!: Date;

  // 静态初始化方法
  // 用于初始化模型，定义字段、类型、验证规则等
  // 这个方法会在应用启动时被调用
  // 由models/index.ts中的User.initialize(sequelize)调用
  // 参数sequelize: Sequelize实例
  public static initialize(sequelize: Sequelize) {
    // 调用Model.init()方法初始化模型
    // 第一个参数：字段定义
    // 第二个参数：模型配置
    this.init(
      {
        id: {
          type: DataTypes.INTEGER,       // 字段类型：整数
          autoIncrement: true,          // 自增
          primaryKey: true,             // 主键
        },
        username: {
          type: DataTypes.STRING,        // 字段类型：字符串
          allowNull: false,             // 不允许为null
          unique: true,                 // 唯一约束
          validate: {
            len: [3, 50],              // 长度验证：3-50个字符
          },
        },
        email: {
          type: DataTypes.STRING,        // 字段类型：字符串
          allowNull: false,             // 不允许为null
          unique: true,                 // 唯一约束
          validate: {
            isEmail: true,              // 验证是否为有效的邮箱格式
          },
        },
        password: {
          type: DataTypes.STRING,        // 字段类型：字符串
          allowNull: false,             // 不允许为null
          validate: {
            len: [6, 100],              // 长度验证：6-100个字符
          },
        },
        avatar: {
          type: DataTypes.STRING,        // 字段类型：字符串
          allowNull: false,             // 不允许为null
          defaultValue: 'https://via.placeholder.com/40',  // 默认值
          validate: {
            len: [1, 255],              // 长度验证：1-255个字符
          },
        },
        status: {
          type: DataTypes.ENUM('online', 'idle', 'do-not-disturb', 'offline'),  // 枚举类型
          allowNull: false,             // 不允许为null
          defaultValue: 'online',       // 默认值
        },
        role: {
          type: DataTypes.ENUM('admin', 'moderator', 'member'),  // 枚举类型
          allowNull: false,             // 不允许为null
          defaultValue: 'member',        // 默认值
        },
      } as any,  // 使用any类型避免TypeScript复杂类型问题
      {
        sequelize,                     // Sequelize实例
        tableName: 'users',            // 数据库表名
        modelName: 'User',             // 模型名称
        // 注意：tableName和modelName的区别
        // tableName: 数据库中实际的表名
        // modelName: Sequelize内部使用的模型名称
        // 在关联关系中使用modelName
        underscored: true,             // 启用下划线命名转换
        // 启用后，Sequelize会自动将驼峰命名转换为下划线命名
        // 例如：createdAt -> created_at, updatedAt -> updated_at
        timestamps: true,              // 启用自动时间戳
        // 启用后，Sequelize会自动添加createdAt和updatedAt字段
      }
    );
  }
}
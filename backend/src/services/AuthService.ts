import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { JWTUtil } from '../security/jwt';

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  avatar?: string;
}

interface AuthResponse {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

export class AuthService {
  /**
   * Hash password
   */
  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compare password
   */
  private async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * User login
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { email, password } = credentials;

    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Compare passwords
    const isPasswordValid = await this.comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const tokens = JWTUtil.generateTokens(user.id, user.username);

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user.toJSON();

    return {
      user: userWithoutPassword as Omit<User, 'password'>,
      ...tokens
    };
  }

  /**
   * User registration
   */
  async register(registerData: RegisterData): Promise<AuthResponse> {
    const { username, email, password, avatar } = registerData;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      avatar: avatar || 'https://via.placeholder.com/40',
      status: 'online',
      role: 'member'
    });

    // Generate tokens
    const tokens = JWTUtil.generateTokens(newUser.id, newUser.username);

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = newUser.toJSON();

    return {
      user: userWithoutPassword as Omit<User, 'password'>,
      ...tokens
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; accessTokenExpiresAt: number }> {
    try {
      const newAccessToken = JWTUtil.refreshToken(refreshToken);
      // 计算新的过期时间
      const accessTokenExpiresAt = Date.now() + 15 * 60 * 1000; // 15分钟
      return { accessToken: newAccessToken, accessTokenExpiresAt };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: number): Promise<Omit<User, 'password'> | null> {
    const user = await User.findByPk(id);
    if (!user) return null;

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user.toJSON();

    return userWithoutPassword as Omit<User, 'password'>;
  }
}
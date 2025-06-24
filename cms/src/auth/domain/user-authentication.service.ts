import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface UserSession {
  userId: string;
  username: string;
  roles: string[];
  sessionId: string;
  issuedAt: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

@Injectable()
export class UserAuthenticationService {
  private readonly logger = new Logger(UserAuthenticationService.name);
  private readonly activeSessions = new Map<string, UserSession>();
  private readonly failedAttempts = new Map<string, { count: number; lastAttempt: Date }>();
  
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 15;
  private readonly SESSION_DURATION_HOURS = 8;
  private readonly REMEMBER_ME_DURATION_DAYS = 30;

  constructor(private configService: ConfigService) {
    this.scheduleSessionCleanup();
  }

  async authenticateUser(credentials: LoginCredentials, clientInfo?: { ip?: string; userAgent?: string }): Promise<UserSession> {
    const { username, password, rememberMe } = credentials;

    // Check for account lockout
    if (this.isAccountLocked(username)) {
      this.logger.warn(`Authentication blocked for locked account: ${username}`);
      throw new UnauthorizedException('Account temporarily locked due to failed attempts');
    }

    try {
      const user = await this.validateCredentials(username, password);
      this.clearFailedAttempts(username);
      
      const session = this.createUserSession(user, rememberMe, clientInfo);
      this.registerActiveSession(session);
      
      this.logger.log(`User authenticated: ${username} (${session.sessionId})`);
      return session;
      
    } catch (error) {
      this.recordFailedAttempt(username);
      this.logger.warn(`Authentication failed for: ${username}`);
      throw error;
    }
  }

  private async validateCredentials(username: string, password: string): Promise<any> {
    // In production, this would check against a user database
    const users = this.getConfiguredUsers();
    const user = users.find(u => u.username === username);
    
    if (!user || !this.verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid username or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    return user;
  }

  private getConfiguredUsers() {
    // This simulates a more realistic user store
    // In production, this would come from database/LDAP/etc
    return [
      {
        userId: 'admin-001',
        username: 'admin',
        passwordHash: this.hashPassword(this.configService.get('ADMIN_PASSWORD', 'admin123')),
        roles: ['admin', 'content-manager'],
        isActive: true,
        department: 'management'
      },
      {
        userId: 'editor-001', 
        username: 'editor',
        passwordHash: this.hashPassword(this.configService.get('EDITOR_PASSWORD', 'editor123')),
        roles: ['editor', 'content-creator'],
        isActive: true,
        department: 'content'
      },
      {
        userId: 'viewer-001',
        username: 'viewer',
        passwordHash: this.hashPassword(this.configService.get('VIEWER_PASSWORD', 'viewer123')),
        roles: ['viewer'],
        isActive: true,
        department: 'guest'
      }
    ];
  }

  private createUserSession(user: any, rememberMe: boolean, clientInfo?: any): UserSession {
    const sessionId = this.generateSessionId();
    const issuedAt = new Date();
    const expiresAt = new Date();
    
    if (rememberMe) {
      expiresAt.setDate(issuedAt.getDate() + this.REMEMBER_ME_DURATION_DAYS);
    } else {
      expiresAt.setHours(issuedAt.getHours() + this.SESSION_DURATION_HOURS);
    }

    return {
      userId: user.userId,
      username: user.username,
      roles: user.roles,
      sessionId,
      issuedAt,
      expiresAt,
      ipAddress: clientInfo?.ip,
      userAgent: clientInfo?.userAgent,
    };
  }

  validateSession(sessionId: string): UserSession | null {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    if (new Date() > session.expiresAt) {
      this.revokeSession(sessionId);
      return null;
    }

    return session;
  }

  revokeSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      this.activeSessions.delete(sessionId);
      this.logger.log(`Session revoked: ${session.username} (${sessionId})`);
    }
  }

  revokeAllUserSessions(userId: string): number {
    let revokedCount = 0;
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        this.activeSessions.delete(sessionId);
        revokedCount++;
      }
    }
    
    if (revokedCount > 0) {
      this.logger.log(`Revoked ${revokedCount} sessions for user: ${userId}`);
    }
    
    return revokedCount;
  }

  private isAccountLocked(username: string): boolean {
    const attempts = this.failedAttempts.get(username);
    if (!attempts || attempts.count < this.MAX_FAILED_ATTEMPTS) {
      return false;
    }

    const lockoutEnd = new Date(attempts.lastAttempt);
    lockoutEnd.setMinutes(lockoutEnd.getMinutes() + this.LOCKOUT_DURATION_MINUTES);
    
    return new Date() < lockoutEnd;
  }

  private recordFailedAttempt(username: string): void {
    const current = this.failedAttempts.get(username) || { count: 0, lastAttempt: new Date() };
    this.failedAttempts.set(username, {
      count: current.count + 1,
      lastAttempt: new Date(),
    });
  }

  private clearFailedAttempts(username: string): void {
    this.failedAttempts.delete(username);
  }

  private registerActiveSession(session: UserSession): void {
    this.activeSessions.set(session.sessionId, session);
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private verifyPassword(plaintext: string, hash: string): boolean {
    // Simplified for demo - in production use bcrypt/scrypt
    return this.hashPassword(plaintext) === hash;
  }

  private hashPassword(password: string): string {
    // Simplified for demo - in production use proper hashing
    return Buffer.from(password).toString('base64');
  }

  private scheduleSessionCleanup(): void {
    setInterval(() => {
      const now = new Date();
      let cleanedCount = 0;
      
      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (now > session.expiresAt) {
          this.activeSessions.delete(sessionId);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        this.logger.debug(`Cleaned ${cleanedCount} expired sessions`);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  getUserSessions(userId: string): UserSession[] {
    return Array.from(this.activeSessions.values())
      .filter(session => session.userId === userId);
  }
} 